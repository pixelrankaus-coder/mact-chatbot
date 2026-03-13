/**
 * Production Intelligence — Net Stock Projection Engine
 *
 * Projects closing stock for each of the next 12 weeks per pilot SKU.
 * Formula per week:
 *   Opening stock + Inbound POs − Forecast demand − Existing orders = Projected closing stock
 *
 * Risk classification:
 *   closing_stock < 0           → PROJECTED_STOCKOUT
 *   closing_stock < safety_stock → STOCKOUT_RISK
 *   otherwise                   → null (healthy)
 *
 * Persists results to pi_stock_projections table for Phase 3 consumption.
 */

import { createServiceClient } from "@/lib/supabase";
import { forecastSku } from "@/lib/pi/forecast";

export type RiskFlag = "STOCKOUT_RISK" | "PROJECTED_STOCKOUT" | null;

export interface WeekProjection {
  week_start: string; // YYYY-MM-DD (Monday)
  opening_stock: number;
  inbound_po: number;
  forecast_demand: number;
  existing_orders: number;
  closing_stock: number;
  risk_flag: RiskFlag;
}

export interface SkuProjection {
  sku_id: string;
  sku_code: string;
  name: string;
  current_stock: number;
  safety_stock: number;
  weeks: WeekProjection[];
  stockout_week: string | null; // first week where closing <= 0
  weeks_of_cover: number; // how many weeks until stockout
}

const DEFAULT_SAFETY_STOCK_WEEKS = 2.0; // Default weeks of safety stock

/**
 * Get current stock on hand for a pilot SKU.
 * Reads from cin7_product_stock (synced every 15min by inventory cron)
 * and aggregates across all locations.
 */
async function getCurrentStock(skuId: string): Promise<number> {
  const supabase = createServiceClient();

  // cin7_product_stock uses cin7_product_id which matches pi_skus.cin7_product_id
  const { data } = await supabase
    .from("cin7_product_stock")
    .select("available")
    .eq("cin7_product_id", skuId);

  if (!data || data.length === 0) return 0;

  // Sum available stock across all locations
  return data.reduce((sum: number, row: { available: number }) => sum + (row.available || 0), 0);
}

/**
 * Get inbound PO quantities per week for a SKU
 */
async function getInboundPOs(
  skuCode: string
): Promise<Map<string, number>> {
  const supabase = createServiceClient();

  // Get open PO lines for this SKU
  const { data: lines } = await supabase
    .from("pi_purchase_order_lines")
    .select("qty_ordered, qty_received, po_id")
    .eq("sku_code", skuCode);

  if (!lines || lines.length === 0) return new Map();

  // Get expected dates from PO headers
  const poIds = [...new Set(lines.map((l) => l.po_id))];
  const { data: pos } = await supabase
    .from("pi_purchase_orders")
    .select("id, expected_date, status")
    .in("id", poIds)
    .in("status", ["Ordered", "Approved", "Partially Received"]);

  if (!pos || pos.length === 0) return new Map();

  const poDateMap = new Map(pos.map((p) => [p.id, p.expected_date]));
  const weeklyInbound = new Map<string, number>();

  for (const line of lines) {
    const expectedDate = poDateMap.get(line.po_id);
    if (!expectedDate) continue;

    const remaining = (line.qty_ordered || 0) - (line.qty_received || 0);
    if (remaining <= 0) continue;

    // Bucket by week (Monday)
    const monday = getMonday(new Date(expectedDate));
    const key = formatDate(monday);
    weeklyInbound.set(key, (weeklyInbound.get(key) || 0) + remaining);
  }

  return weeklyInbound;
}

/**
 * Get existing confirmed orders (demand already committed) per week.
 * Joins cin7_order_items with cin7_orders to get status filtering.
 */
async function getExistingOrders(
  skuCode: string
): Promise<Map<string, number>> {
  const supabase = createServiceClient();
  const today = new Date().toISOString().split("T")[0];

  // Get in-progress orders from cin7_orders
  const { data: orders } = await supabase
    .from("cin7_orders")
    .select("cin7_id, order_date")
    .in("status", ["ORDERING", "ORDERED", "APPROVED", "PICKING", "PACKED", "BACKORDERED"])
    .gte("order_date", today);

  if (!orders || orders.length === 0) return new Map();

  // Get line items for these orders matching our SKU
  const orderIds = orders.map((o) => o.cin7_id);
  const { data: items } = await supabase
    .from("cin7_order_items")
    .select("order_cin7_id, quantity")
    .eq("sku", skuCode)
    .in("order_cin7_id", orderIds);

  if (!items || items.length === 0) return new Map();

  // Build order date lookup
  const orderDateMap = new Map(orders.map((o) => [o.cin7_id, o.order_date]));

  const weeklyOrders = new Map<string, number>();
  for (const item of items) {
    const orderDate = orderDateMap.get(item.order_cin7_id);
    if (!orderDate) continue;
    const monday = getMonday(new Date(orderDate));
    const key = formatDate(monday);
    weeklyOrders.set(key, (weeklyOrders.get(key) || 0) + (item.quantity || 0));
  }

  return weeklyOrders;
}

/**
 * Get forecast demand per week from pi_forecasts
 */
async function getForecastDemand(
  skuId: string
): Promise<Map<string, number>> {
  const supabase = createServiceClient();

  const { data: forecasts } = await supabase
    .from("pi_forecasts")
    .select("week_start, effective_qty")
    .eq("sku_id", skuId)
    .order("week_start", { ascending: true });

  if (!forecasts || forecasts.length === 0) return new Map();

  return new Map(forecasts.map((f) => [f.week_start, f.effective_qty || 0]));
}

/**
 * Classify risk for a week
 */
function classifyRisk(closingStock: number, safetyStock: number): RiskFlag {
  if (closingStock < 0) return "PROJECTED_STOCKOUT";
  if (closingStock < safetyStock) return "STOCKOUT_RISK";
  return null;
}

/**
 * Run projection for a single SKU
 */
export async function projectSku(
  skuId: string,
  skuCode: string,
  skuName: string,
  safetyStock?: number
): Promise<SkuProjection> {
  const safety = safetyStock ?? 0;

  // Gather all inputs in parallel
  const [currentStock, inboundPOs, existingOrders, forecastDemand] =
    await Promise.all([
      getCurrentStock(skuId),
      getInboundPOs(skuCode),
      getExistingOrders(skuCode),
      getForecastDemand(skuId),
    ]);

  // Build 12-week projection
  const today = new Date();
  const nextMonday = getMonday(new Date(today.getTime() + 7 * 86400000));
  const weeks: WeekProjection[] = [];
  let openingStock = currentStock;
  let stockoutWeek: string | null = null;
  let weeksOfCover = 12;

  for (let i = 0; i < 12; i++) {
    const weekStart = new Date(nextMonday.getTime() + i * 7 * 86400000);
    const weekKey = formatDate(weekStart);

    const inbound = inboundPOs.get(weekKey) || 0;
    const forecast = forecastDemand.get(weekKey) || 0;
    const orders = existingOrders.get(weekKey) || 0;

    const closingStock = openingStock + inbound - forecast - orders;
    const riskFlag = classifyRisk(closingStock, safety);

    if (closingStock <= 0 && !stockoutWeek) {
      stockoutWeek = weekKey;
      weeksOfCover = i;
    }

    weeks.push({
      week_start: weekKey,
      opening_stock: Math.round(openingStock * 100) / 100,
      inbound_po: inbound,
      forecast_demand: Math.round(forecast * 100) / 100,
      existing_orders: orders,
      closing_stock: Math.round(closingStock * 100) / 100,
      risk_flag: riskFlag,
    });

    openingStock = closingStock;
  }

  return {
    sku_id: skuId,
    sku_code: skuCode,
    name: skuName,
    current_stock: currentStock,
    safety_stock: safety,
    weeks,
    stockout_week: stockoutWeek,
    weeks_of_cover: weeksOfCover,
  };
}

/**
 * Run projections for all pilot SKUs and persist to pi_stock_projections
 */
export async function runAllProjections(): Promise<{
  projections: SkuProjection[];
  error?: string;
}> {
  const supabase = createServiceClient();

  try {
    const { data: pilotSkus } = await supabase
      .from("pi_skus")
      .select("cin7_product_id, sku_code, name, safety_stock_weeks")
      .eq("is_pilot", true);

    if (!pilotSkus || pilotSkus.length === 0) {
      return { projections: [], error: "No pilot SKUs configured" };
    }

    const projections: SkuProjection[] = [];
    const now = new Date().toISOString();

    for (const sku of pilotSkus) {
      // Calculate dynamic safety stock: weeks × avg weekly demand
      const safetyWeeks = sku.safety_stock_weeks ?? DEFAULT_SAFETY_STOCK_WEEKS;
      const { weeklyAvg } = await forecastSku(sku.cin7_product_id, sku.sku_code);
      const safetyStockUnits = Math.round(safetyWeeks * weeklyAvg * 100) / 100;

      const projection = await projectSku(
        sku.cin7_product_id,
        sku.sku_code,
        sku.name,
        safetyStockUnits
      );
      projections.push(projection);

      // Persist to pi_stock_projections
      const rows = projection.weeks.map((w) => ({
        sku_id: sku.cin7_product_id,
        week_start: w.week_start,
        opening_stock: w.opening_stock,
        inbound_qty: w.inbound_po,
        forecast_demand: w.forecast_demand,
        confirmed_orders: w.existing_orders,
        closing_stock: w.closing_stock,
        safety_stock_level: projection.safety_stock,
        risk_flag: w.risk_flag,
        generated_at: now,
      }));

      if (rows.length > 0) {
        await supabase
          .from("pi_stock_projections")
          .upsert(rows, { onConflict: "sku_id,week_start" });
      }
    }

    // Sort by weeks of cover (most urgent first)
    projections.sort((a, b) => a.weeks_of_cover - b.weeks_of_cover);

    return { projections };
  } catch (err) {
    return {
      projections: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
