import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

/**
 * GET /api/production-intelligence/mrp/overdue
 * Returns only OVERDUE and URGENT material requirements — for alert banner
 */
export async function GET() {
  try {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("pi_material_requirements")
      .select("component_sku_id, week_start, shortfall_qty, order_qty, order_by_date, urgency_flag, estimated_cost")
      .in("urgency_flag", ["OVERDUE", "URGENT"])
      .gt("shortfall_qty", 0)
      .order("order_by_date", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Enrich with names
    const componentIds = [...new Set((data || []).map((d) => d.component_sku_id))];
    let bomNames: { component_sku_id: string; component_name: string }[] = [];
    if (componentIds.length > 0) {
      const { data: names } = await supabase
        .from("pi_bom_items")
        .select("component_sku_id, component_name")
        .in("component_sku_id", componentIds);
      bomNames = names || [];
    }

    const nameMap = new Map<string, string>();
    for (const b of bomNames || []) {
      if (b.component_sku_id && b.component_name) {
        nameMap.set(b.component_sku_id, b.component_name);
      }
    }

    const items = (data || []).map((d) => ({
      ...d,
      component_name: nameMap.get(d.component_sku_id) || d.component_sku_id,
    }));

    return NextResponse.json({
      count: items.length,
      overdue_count: items.filter((i) => i.urgency_flag === "OVERDUE").length,
      urgent_count: items.filter((i) => i.urgency_flag === "URGENT").length,
      items,
    });
  } catch (error) {
    console.error("[MRP] Overdue error:", error);
    return NextResponse.json({ error: "Failed to load overdue items" }, { status: 500 });
  }
}
