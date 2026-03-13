import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

/**
 * GET /api/production-intelligence/mrp/[componentSkuId]
 * Returns 12-week detail for a single component material
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ componentSkuId: string }> }
) {
  try {
    const { componentSkuId } = await params;
    const supabase = createServiceClient();

    // Get weekly requirements
    const { data: weeks, error } = await supabase
      .from("pi_material_requirements")
      .select("*")
      .eq("component_sku_id", componentSkuId)
      .order("week_start", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get component name from BOM
    const { data: bomItem } = await supabase
      .from("pi_bom_items")
      .select("component_name, component_sku_id")
      .eq("component_sku_id", componentSkuId)
      .limit(1)
      .single();

    // Get supplier config
    const { data: supplierConfig } = await supabase
      .from("pi_material_suppliers")
      .select("*, pi_suppliers(id, name, contact_name, email, phone)")
      .eq("sku_id", componentSkuId)
      .eq("is_preferred", true)
      .limit(1)
      .single();

    // Get current stock
    const { data: stockRows } = await supabase
      .from("cin7_product_stock")
      .select("available")
      .eq("cin7_product_id", componentSkuId);

    const currentStock = (stockRows || []).reduce(
      (sum, r) => sum + (r.available || 0),
      0
    );

    // Get finished goods that use this component
    const { data: finishedGoods } = await supabase
      .from("pi_bom_items")
      .select("finished_sku_id, qty_per_batch, pi_skus!pi_bom_items_finished_sku_id_fkey(name, sku_code, std_batch_size)")
      .eq("component_sku_id", componentSkuId);

    // Determine worst urgency
    const urgencyRank: Record<string, number> = { OVERDUE: 3, URGENT: 2, UPCOMING: 1, OK: 0 };
    let worstUrgency = "OK";
    for (const w of weeks || []) {
      if ((urgencyRank[w.urgency_flag] || 0) > (urgencyRank[worstUrgency] || 0)) {
        worstUrgency = w.urgency_flag;
      }
    }

    return NextResponse.json({
      component_sku_id: componentSkuId,
      component_name: bomItem?.component_name || componentSkuId,
      current_stock: currentStock,
      moq: supplierConfig?.moq || null,
      order_multiple: supplierConfig?.order_multiple || null,
      lead_time_days: supplierConfig?.lead_time_days || 14,
      unit_cost: supplierConfig?.unit_cost || null,
      urgency_flag: worstUrgency,
      supplier: supplierConfig?.pi_suppliers || null,
      has_supplier_config: !!supplierConfig,
      weeks: weeks || [],
      finished_goods: (finishedGoods || []).map((fg) => ({
        sku_id: fg.finished_sku_id,
        name: (fg.pi_skus as Record<string, unknown>)?.name || fg.finished_sku_id,
        sku_code: (fg.pi_skus as Record<string, unknown>)?.sku_code || "",
        qty_per_batch: fg.qty_per_batch,
        std_batch_size: (fg.pi_skus as Record<string, unknown>)?.std_batch_size || 1,
      })),
    });
  } catch (error) {
    console.error("[MRP] Component detail error:", error);
    return NextResponse.json(
      { error: "Failed to load component detail" },
      { status: 500 }
    );
  }
}
