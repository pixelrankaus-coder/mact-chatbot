/**
 * Production Intelligence — Materials Requirements Engine (MRP)
 *
 * Explodes BOM for planned production into component-level raw material
 * requirements per week. Compares against available stock and inbound POs
 * to surface shortfalls and calculate order-by dates.
 *
 * Pipeline position: runs after projection engine in nightly cron.
 */

import { createServiceClient } from "@/lib/supabase";

// ─── Types ──────────────────────────────────────────────────────────────────

export type UrgencyFlag = "OVERDUE" | "URGENT" | "UPCOMING" | "OK";

export interface MaterialRequirement {
  component_sku_id: string;
  component_name: string;
  week_start: string;
  required_qty: number;
  available_qty: number;
  shortfall_qty: number;
  order_qty: number;
  order_by_date: string;
  urgency_flag: UrgencyFlag;
  supplier_id: string | null;
  estimated_cost: number | null;
}

interface BomItem {
  finished_sku_id: string;
  component_sku_id: string | null;
  component_name: string;
  qty_per_batch: number;
}

interface SupplierConfig {
  supplier_id: string;
  lead_time_days: number;
  moq: number | null;
  order_multiple: number | null;
  unit_cost: number | null;
}

const DEFAULT_LEAD_TIME_DAYS = 14;

// ─── Helper: get component stock from cin7_product_stock ────────────────────

async function getComponentStock(
  supabase: ReturnType<typeof createServiceClient>,
  componentSkuIds: string[]
): Promise<Map<string, number>> {
  if (componentSkuIds.length === 0) return new Map();

  const { data } = await supabase
    .from("cin7_product_stock")
    .select("cin7_product_id, available")
    .in("cin7_product_id", componentSkuIds);

  const stockMap = new Map<string, number>();
  for (const row of data || []) {
    const current = stockMap.get(row.cin7_product_id) || 0;
    stockMap.set(row.cin7_product_id, current + (row.available || 0));
  }
  return stockMap;
}

// ─── Helper: get inbound PO quantities for components ───────────────────────

async function getComponentInboundPOs(
  supabase: ReturnType<typeof createServiceClient>,
  componentSkuCodes: string[],
  beforeDate: string
): Promise<Map<string, number>> {
  if (componentSkuCodes.length === 0) return new Map();

  // Get open PO lines for component SKUs
  const { data: lines } = await supabase
    .from("pi_purchase_order_lines")
    .select("sku_code, qty_ordered, qty_received, po_id")
    .in("sku_code", componentSkuCodes);

  if (!lines || lines.length === 0) return new Map();

  const poIds = [...new Set(lines.map((l) => l.po_id))];
  const { data: pos } = await supabase
    .from("pi_purchase_orders")
    .select("id, expected_date, status")
    .in("id", poIds)
    .in("status", ["Ordered", "Approved", "Partially Received"])
    .lte("expected_date", beforeDate);

  if (!pos || pos.length === 0) return new Map();

  const validPoIds = new Set(pos.map((p) => p.id));
  const inboundMap = new Map<string, number>();

  for (const line of lines) {
    if (!validPoIds.has(line.po_id)) continue;
    const remaining = (line.qty_ordered || 0) - (line.qty_received || 0);
    if (remaining <= 0) continue;
    const current = inboundMap.get(line.sku_code) || 0;
    inboundMap.set(line.sku_code, current + remaining);
  }

  return inboundMap;
}

// ─── Helper: get preferred supplier config for components ───────────────────

async function getSupplierConfigs(
  supabase: ReturnType<typeof createServiceClient>,
  componentSkuIds: string[]
): Promise<Map<string, SupplierConfig>> {
  if (componentSkuIds.length === 0) return new Map();

  const { data } = await supabase
    .from("pi_material_suppliers")
    .select("sku_id, supplier_id, lead_time_days, moq, order_multiple, unit_cost")
    .in("sku_id", componentSkuIds)
    .eq("is_preferred", true);

  const configMap = new Map<string, SupplierConfig>();
  for (const row of data || []) {
    configMap.set(row.sku_id, {
      supplier_id: row.supplier_id,
      lead_time_days: row.lead_time_days || DEFAULT_LEAD_TIME_DAYS,
      moq: row.moq,
      order_multiple: row.order_multiple,
      unit_cost: row.unit_cost,
    });
  }
  return configMap;
}

// ─── Helper: classify urgency ───────────────────────────────────────────────

function classifyUrgency(
  orderByDate: Date,
  today: Date,
  shortfall: number
): UrgencyFlag {
  if (shortfall <= 0) return "OK";

  const diffMs = orderByDate.getTime() - today.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays < 0) return "OVERDUE";
  if (diffDays < 7) return "URGENT";
  if (diffDays < 14) return "UPCOMING";
  return "OK";
}

// ─── Helper: apply MOQ and order multiple ───────────────────────────────────

function applyOrderConstraints(
  shortfall: number,
  moq: number | null,
  orderMultiple: number | null
): number {
  if (shortfall <= 0) return 0;

  let qty = shortfall;

  // Apply MOQ
  if (moq && moq > 0 && qty < moq) {
    qty = moq;
  }

  // Round up to order multiple
  if (orderMultiple && orderMultiple > 0) {
    qty = Math.ceil(qty / orderMultiple) * orderMultiple;
  }

  return qty;
}

// ─── Main MRP Engine ────────────────────────────────────────────────────────

export async function runMRPForAllPilotSkus(): Promise<{
  materials: number;
  overdue: number;
  urgent: number;
  error?: string;
}> {
  const supabase = createServiceClient();

  try {
    // Step 1: Get stock projections for all pilot SKUs
    const { data: projections } = await supabase
      .from("pi_stock_projections")
      .select("sku_id, week_start, closing_stock, safety_stock_level, forecast_demand")
      .order("week_start", { ascending: true });

    if (!projections || projections.length === 0) {
      return { materials: 0, overdue: 0, urgent: 0, error: "No projections found — run projection engine first" };
    }

    // Step 2: Get all BOM items for pilot SKUs
    const { data: pilotSkus } = await supabase
      .from("pi_skus")
      .select("cin7_product_id, sku_code, std_batch_size")
      .eq("is_pilot", true);

    if (!pilotSkus || pilotSkus.length === 0) {
      return { materials: 0, overdue: 0, urgent: 0, error: "No pilot SKUs configured" };
    }

    const pilotSkuIds = pilotSkus.map((s) => s.cin7_product_id);
    const skuBatchSizeMap = new Map(
      pilotSkus.map((s) => [s.cin7_product_id, s.std_batch_size || 1])
    );

    const { data: bomItems } = await supabase
      .from("pi_bom_items")
      .select("finished_sku_id, component_sku_id, component_name, qty_per_batch")
      .in("finished_sku_id", pilotSkuIds);

    if (!bomItems || bomItems.length === 0) {
      console.warn("[MRP] No BOM items found for pilot SKUs");
      return { materials: 0, overdue: 0, urgent: 0, error: "No BOM data — sync BOMs first" };
    }

    // Group projections by SKU
    const projectionsBySkuWeek = new Map<string, { closing_stock: number; safety_stock_level: number; forecast_demand: number }>();
    for (const p of projections) {
      const key = `${p.sku_id}:${p.week_start}`;
      projectionsBySkuWeek.set(key, {
        closing_stock: p.closing_stock || 0,
        safety_stock_level: p.safety_stock_level || 0,
        forecast_demand: p.forecast_demand || 0,
      });
    }

    // Get unique weeks from projections
    const weekStarts = [...new Set(projections.map((p) => p.week_start))].sort();

    // Step 3: Calculate production requirements and explode BOM
    // componentRequirements[componentId][weekStart] = total qty needed
    const componentRequirements = new Map<string, Map<string, number>>();
    const componentNames = new Map<string, string>();

    for (const bom of bomItems) {
      if (!bom.component_sku_id) continue;

      const stdBatchSize = skuBatchSizeMap.get(bom.finished_sku_id) || 1;
      const componentRatio = bom.qty_per_batch / stdBatchSize;

      componentNames.set(bom.component_sku_id, bom.component_name || bom.component_sku_id);

      for (const week of weekStarts) {
        const key = `${bom.finished_sku_id}:${week}`;
        const proj = projectionsBySkuWeek.get(key);
        if (!proj) continue;

        // Production required = bring stock back above safety level
        const productionRequired = Math.max(
          0,
          proj.safety_stock_level - proj.closing_stock + proj.forecast_demand
        );

        if (productionRequired <= 0) continue;

        const componentNeeded = productionRequired * componentRatio;

        if (!componentRequirements.has(bom.component_sku_id)) {
          componentRequirements.set(bom.component_sku_id, new Map());
        }
        const weekMap = componentRequirements.get(bom.component_sku_id)!;
        weekMap.set(week, (weekMap.get(week) || 0) + componentNeeded);
      }
    }

    if (componentRequirements.size === 0) {
      return { materials: 0, overdue: 0, urgent: 0 };
    }

    // Step 4: Get available stock and supplier configs for all components
    const allComponentIds = [...componentRequirements.keys()];

    // Look up sku_codes for component IDs (they may be in pi_skus or just use the ID)
    const { data: componentSkus } = await supabase
      .from("pi_skus")
      .select("cin7_product_id, sku_code")
      .in("cin7_product_id", allComponentIds);

    const componentSkuCodeMap = new Map(
      (componentSkus || []).map((s) => [s.cin7_product_id, s.sku_code])
    );

    const [componentStockMap, supplierConfigs] = await Promise.all([
      getComponentStock(supabase, allComponentIds),
      getSupplierConfigs(supabase, allComponentIds),
    ]);

    // Step 5: Calculate shortfalls, order-by dates, urgency
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const now = new Date().toISOString();
    const rows: Array<Record<string, unknown>> = [];
    let overdueCount = 0;
    let urgentCount = 0;

    for (const [componentId, weeklyRequirements] of componentRequirements) {
      const currentStock = componentStockMap.get(componentId) || 0;
      const supplier = supplierConfigs.get(componentId);
      const leadTimeDays = supplier?.lead_time_days || DEFAULT_LEAD_TIME_DAYS;

      // Get inbound POs for this component
      const skuCode = componentSkuCodeMap.get(componentId) || componentId;

      // Running available stock across weeks
      let runningAvailable = currentStock;

      for (const week of weekStarts) {
        const required = weeklyRequirements.get(week) || 0;
        if (required <= 0) {
          // Still persist an OK row for the week
          rows.push({
            component_sku_id: componentId,
            week_start: week,
            required_qty: 0,
            available_qty: Math.round(runningAvailable * 100) / 100,
            shortfall_qty: 0,
            order_qty: 0,
            order_by_date: null,
            urgency_flag: "OK",
            supplier_id: supplier?.supplier_id || null,
            estimated_cost: null,
            generated_at: now,
          });
          continue;
        }

        const shortfall = Math.max(0, required - runningAvailable);
        const orderQty = applyOrderConstraints(
          shortfall,
          supplier?.moq || null,
          supplier?.order_multiple || null
        );

        // Calculate order-by date
        const weekDate = new Date(week + "T00:00:00");
        const orderByDate = new Date(weekDate.getTime() - leadTimeDays * 24 * 60 * 60 * 1000);
        const orderByStr = orderByDate.toISOString().split("T")[0];

        const urgency = classifyUrgency(orderByDate, today, shortfall);
        if (urgency === "OVERDUE") overdueCount++;
        if (urgency === "URGENT") urgentCount++;

        const estimatedCost =
          supplier?.unit_cost && orderQty > 0
            ? Math.round(orderQty * supplier.unit_cost * 100) / 100
            : null;

        rows.push({
          component_sku_id: componentId,
          week_start: week,
          required_qty: Math.round(required * 100) / 100,
          available_qty: Math.round(runningAvailable * 100) / 100,
          shortfall_qty: Math.round(shortfall * 100) / 100,
          order_qty: Math.round(orderQty * 100) / 100,
          order_by_date: shortfall > 0 ? orderByStr : null,
          urgency_flag: urgency,
          supplier_id: supplier?.supplier_id || null,
          estimated_cost: estimatedCost,
          generated_at: now,
        });

        // Reduce running available for next week
        runningAvailable = Math.max(0, runningAvailable - required);
      }
    }

    // Step 6: Persist to pi_material_requirements
    if (rows.length > 0) {
      // Batch upsert in chunks of 200
      for (let i = 0; i < rows.length; i += 200) {
        const chunk = rows.slice(i, i + 200);
        const { error } = await supabase
          .from("pi_material_requirements")
          .upsert(chunk, { onConflict: "component_sku_id,week_start" });
        if (error) {
          console.error("[MRP] Upsert error:", error.message);
        }
      }
    }

    console.log(`[MRP] Complete: ${componentRequirements.size} materials, ${rows.length} rows, ${overdueCount} overdue, ${urgentCount} urgent`);

    return {
      materials: componentRequirements.size,
      overdue: overdueCount,
      urgent: urgentCount,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[MRP] Engine error:", msg);
    return { materials: 0, overdue: 0, urgent: 0, error: msg };
  }
}
