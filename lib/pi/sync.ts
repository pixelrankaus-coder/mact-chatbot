/**
 * Production Intelligence — Sync Engine
 *
 * Resumable, throttle-safe sync jobs for pilot SKUs.
 * Each sync type has its own checkpoint in pi_sync_log.
 */

import { createServiceClient } from "@/lib/supabase";
import {
  cin7Fetch,
  type Cin7ProductListResponse,
  type Cin7PurchaseOrderListResponse,
  type Cin7PurchaseOrderDetailResponse,
} from "./cin7-throttle";

type SyncType = "skus" | "sales_history" | "stock_snapshot" | "bom_items" | "purchase_orders";

// ─── Sync Log Helpers ───────────────────────────────────────────────────────

async function startSyncRun(syncType: SyncType) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("pi_sync_log")
    .insert({
      sync_type: syncType,
      status: "running",
      started_at: new Date().toISOString(),
      last_page: 0,
      records_fetched: 0,
    })
    .select("id")
    .single();
  return data!.id as string;
}

async function updateSyncProgress(runId: string, page: number, records: number) {
  const supabase = createServiceClient();
  await supabase
    .from("pi_sync_log")
    .update({ last_page: page, records_fetched: records, updated_at: new Date().toISOString() })
    .eq("id", runId);
}

async function completeSyncRun(runId: string, records: number) {
  const supabase = createServiceClient();
  await supabase
    .from("pi_sync_log")
    .update({
      status: "complete",
      records_fetched: records,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", runId);
}

async function failSyncRun(runId: string, error: string) {
  const supabase = createServiceClient();
  await supabase
    .from("pi_sync_log")
    .update({
      status: "failed",
      error_message: error,
      updated_at: new Date().toISOString(),
    })
    .eq("id", runId);
}

// ─── Get Pilot SKU IDs ──────────────────────────────────────────────────────

async function getPilotSkuCodes(): Promise<string[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("pi_skus")
    .select("sku_code")
    .eq("is_pilot", true);
  return (data || []).map((r: { sku_code: string }) => r.sku_code);
}

async function getPilotSkuIds(): Promise<string[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("pi_skus")
    .select("cin7_product_id")
    .eq("is_pilot", true);
  return (data || []).map((r: { cin7_product_id: string }) => r.cin7_product_id);
}

// ─── Sync: SKUs ─────────────────────────────────────────────────────────────

export async function syncSkus(): Promise<{ records: number; error?: string }> {
  const runId = await startSyncRun("skus");
  const supabase = createServiceClient();
  let totalRecords = 0;

  try {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const data = await cin7Fetch<Cin7ProductListResponse>("product", {
        Page: page,
        Limit: 250,
      });

      const products = data.Products || [];
      if (products.length === 0) {
        hasMore = false;
        break;
      }

      // Upsert into pi_skus
      const rows = products
        .filter((p) => p.Status === "Active")
        .map((p) => ({
          cin7_product_id: p.ID,
          sku_code: p.SKU,
          name: p.Name,
          category: p.Category || null,
          unit_of_measure: p.UOM || null,
          is_active: true,
          updated_at: new Date().toISOString(),
        }));

      if (rows.length > 0) {
        await supabase
          .from("pi_skus")
          .upsert(rows, { onConflict: "cin7_product_id" });
        totalRecords += rows.length;
      }

      await updateSyncProgress(runId, page, totalRecords);
      page++;

      if (products.length < 250) hasMore = false;
    }

    await completeSyncRun(runId, totalRecords);
    return { records: totalRecords };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await failSyncRun(runId, msg);
    return { records: totalRecords, error: msg };
  }
}

// ─── Sync: Sales History (6 months, pilot SKUs only) ────────────────────────
// Uses existing cin7_order_items table (already synced) instead of hitting the API.
// This is fast — pure DB-to-DB copy, no Cin7 API calls.

export async function syncSalesHistory(): Promise<{ records: number; error?: string }> {
  const runId = await startSyncRun("sales_history");
  const supabase = createServiceClient();
  let totalRecords = 0;

  try {
    const pilotSkuCodes = await getPilotSkuCodes();
    if (pilotSkuCodes.length === 0) {
      await completeSyncRun(runId, 0);
      return { records: 0, error: "No pilot SKUs configured" };
    }

    // Pull from cin7_order_items (already synced by existing cron)
    // 24 months gives the forecast engine enough history for seasonality detection
    const lookbackStart = new Date();
    lookbackStart.setMonth(lookbackStart.getMonth() - 24);
    const cutoff = lookbackStart.toISOString().split("T")[0];

    // Fetch in batches by pilot SKU to avoid PostgREST row limits
    for (const skuCode of pilotSkuCodes) {
      const { data: items, error: fetchErr } = await supabase
        .from("cin7_order_items")
        .select("order_cin7_id, order_number, order_date, sku, product_name, quantity, unit_price, total_price, category")
        .eq("sku", skuCode)
        .gte("order_date", cutoff)
        .order("order_date", { ascending: false })
        .limit(1000);

      if (fetchErr || !items || items.length === 0) continue;

      const rows = items.map((item: { order_cin7_id: string; sku: string; order_date: string; quantity: number; unit_price: number; total_price: number; product_name: string }) => ({
        cin7_order_id: item.order_cin7_id,
        sku_code: item.sku,
        order_date: item.order_date?.split("T")[0] || item.order_date,
        qty_sold: item.quantity || 0,
        unit_price: item.unit_price || 0,
        line_total: item.total_price || 0,
        channel: "B2B",
        customer_name: null,
      }));

      if (rows.length > 0) {
        await supabase
          .from("pi_sales_history")
          .upsert(rows, { onConflict: "cin7_order_id,sku_code" });
        totalRecords += rows.length;
      }

      await updateSyncProgress(runId, pilotSkuCodes.indexOf(skuCode) + 1, totalRecords);
    }

    await completeSyncRun(runId, totalRecords);
    return { records: totalRecords };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await failSyncRun(runId, msg);
    return { records: totalRecords, error: msg };
  }
}

// ─── Sync: Stock Snapshot ───────────────────────────────────────────────────
// Reads from cin7_product_stock (already synced every 15min by inventory cron).
// DB-to-DB — no Cin7 API calls needed. Aggregates per-location stock into daily snapshots.

export async function syncStockSnapshot(): Promise<{ records: number; error?: string }> {
  const runId = await startSyncRun("stock_snapshot");
  const supabase = createServiceClient();
  let totalRecords = 0;

  try {
    const pilotSkuIds = await getPilotSkuIds();
    if (pilotSkuIds.length === 0) {
      await completeSyncRun(runId, 0);
      return { records: 0, error: "No pilot SKUs configured" };
    }

    const today = new Date().toISOString().split("T")[0];

    // Fetch all stock rows for pilot SKUs in one query
    const { data: stockRows, error: fetchErr } = await supabase
      .from("cin7_product_stock")
      .select("cin7_product_id, on_hand, available, allocated, on_order")
      .in("cin7_product_id", pilotSkuIds);

    if (fetchErr) throw fetchErr;

    // Aggregate per SKU across locations
    const stockMap: Record<string, { on_hand: number; available: number; allocated: number; on_order: number }> = {};
    for (const row of stockRows || []) {
      const pid = row.cin7_product_id;
      if (!stockMap[pid]) stockMap[pid] = { on_hand: 0, available: 0, allocated: 0, on_order: 0 };
      stockMap[pid].on_hand += row.on_hand || 0;
      stockMap[pid].available += row.available || 0;
      stockMap[pid].allocated += row.allocated || 0;
      stockMap[pid].on_order += row.on_order || 0;
    }

    // Upsert snapshots for each pilot SKU
    for (const productId of pilotSkuIds) {
      const stock = stockMap[productId] || { on_hand: 0, available: 0, allocated: 0, on_order: 0 };

      await supabase
        .from("pi_stock_snapshots")
        .upsert(
          {
            sku_id: productId,
            snapshot_date: today,
            qty_on_hand: stock.on_hand,
            qty_available: stock.available,
            qty_allocated: stock.allocated,
            qty_on_order: stock.on_order,
          },
          { onConflict: "sku_id,snapshot_date" }
        );
      totalRecords++;

      await updateSyncProgress(runId, pilotSkuIds.indexOf(productId) + 1, totalRecords);
    }

    await completeSyncRun(runId, totalRecords);
    return { records: totalRecords };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await failSyncRun(runId, msg);
    return { records: totalRecords, error: msg };
  }
}

// ─── Sync: BOMs (for pilot SKUs) ───────────────────────────────────────────

export async function syncBomItems(): Promise<{ records: number; error?: string }> {
  const runId = await startSyncRun("bom_items");
  const supabase = createServiceClient();
  let totalRecords = 0;

  try {
    const pilotSkuIds = await getPilotSkuIds();
    if (pilotSkuIds.length === 0) {
      await completeSyncRun(runId, 0);
      return { records: 0, error: "No pilot SKUs configured" };
    }

    // Cin7 Core: fetch product detail and extract BOM components
    for (const productId of pilotSkuIds) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = await cin7Fetch<any>("product", {
          ID: productId,
        });

        const product = data.Products?.[0];

        // Coalesce known BOM field names — Cin7 docs are ambiguous
        const bomComponents: Array<Record<string, unknown>> | null =
          product?.BillOfMaterialsProducts ??
          product?.BOMProducts ??
          product?.Components ??
          null;

        if (!bomComponents || !Array.isArray(bomComponents) || bomComponents.length === 0) {
          console.warn(
            `[PI BOM] No BOM data for ${productId} — product keys:`,
            Object.keys(product || {}).join(", ")
          );
          continue;
        }

        // Delete existing BOM entries for this SKU and re-insert
        await supabase
          .from("pi_bom_items")
          .delete()
          .eq("finished_sku_id", productId);

        // Normalise both possible component shapes
        // Shape A: { ComponentProductID, ComponentSKU, ComponentName, Quantity, UOM }
        // Shape B: { ProductID, SKU, Name, Quantity, Type }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rows = bomComponents.map((comp: any) => ({
          finished_sku_id: productId,
          component_sku_id: comp.ComponentProductID || comp.ProductID || null,
          component_name: comp.ComponentName || comp.Name || comp.ComponentSKU || comp.SKU,
          qty_per_batch: comp.Quantity,
          unit_of_measure: comp.UOM || null,
        }));

        if (rows.length > 0) {
          await supabase.from("pi_bom_items").insert(rows);
          totalRecords += rows.length;
        }
      } catch (err) {
        // Individual BOM fetch failure shouldn't kill the whole sync
        console.warn(`[PI] BOM fetch failed for ${productId}:`, err);
      }
    }

    await completeSyncRun(runId, totalRecords);
    return { records: totalRecords };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await failSyncRun(runId, msg);
    return { records: totalRecords, error: msg };
  }
}

// ─── Sync: Purchase Orders ──────────────────────────────────────────────────

export async function syncPurchaseOrders(): Promise<{ records: number; error?: string }> {
  const runId = await startSyncRun("purchase_orders");
  const supabase = createServiceClient();
  let totalRecords = 0;

  try {
    // Fetch open/pending POs only
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const listData = await cin7Fetch<Cin7PurchaseOrderListResponse>("purchaseList", {
        Page: page,
        Limit: 250,
        Status: "Ordered", // Active POs
      });

      const orders = listData.PurchaseList || [];
      if (orders.length === 0) {
        hasMore = false;
        break;
      }

      for (const po of orders) {
        // Upsert PO header
        const { data: poRow } = await supabase
          .from("pi_purchase_orders")
          .upsert(
            {
              cin7_po_id: po.PurchaseID,
              po_number: po.OrderNumber,
              supplier: po.Supplier,
              status: po.Status,
              order_date: po.OrderDate?.split("T")[0] || null,
              expected_date: po.RequiredBy?.split("T")[0] || null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "cin7_po_id" }
          )
          .select("id")
          .single();

        if (!poRow) continue;

        // Fetch detail for line items
        try {
          const detail = await cin7Fetch<Cin7PurchaseOrderDetailResponse>("purchase", {
            ID: po.PurchaseID,
          });

          const lines = detail.Order?.Lines || [];
          if (lines.length > 0) {
            // Delete old lines and re-insert
            await supabase
              .from("pi_purchase_order_lines")
              .delete()
              .eq("po_id", poRow.id);

            const lineRows = lines.map((line) => ({
              po_id: poRow.id,
              sku_code: line.SKU || null,
              product_name: line.Name || null,
              qty_ordered: line.Quantity,
              qty_received: line.Received || 0,
              unit_price: line.Price,
            }));

            await supabase.from("pi_purchase_order_lines").insert(lineRows);
            totalRecords += lineRows.length;
          }
        } catch (err) {
          console.warn(`[PI] PO detail fetch failed for ${po.PurchaseID}:`, err);
        }
      }

      await updateSyncProgress(runId, page, totalRecords);
      page++;

      if (orders.length < 250) hasMore = false;
    }

    await completeSyncRun(runId, totalRecords);
    return { records: totalRecords };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await failSyncRun(runId, msg);
    return { records: totalRecords, error: msg };
  }
}

// ─── Run All Syncs ──────────────────────────────────────────────────────────

export async function runSync(type: SyncType) {
  switch (type) {
    case "skus":
      return syncSkus();
    case "sales_history":
      return syncSalesHistory();
    case "stock_snapshot":
      return syncStockSnapshot();
    case "bom_items":
      return syncBomItems();
    case "purchase_orders":
      return syncPurchaseOrders();
    default:
      throw new Error(`Unknown sync type: ${type}`);
  }
}

export const SYNC_TYPES: SyncType[] = [
  "skus",
  "sales_history",
  "stock_snapshot",
  "bom_items",
  "purchase_orders",
];
