import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

/**
 * GET /api/production-intelligence/mrp
 * Returns material requirements with optional filter
 * ?filter=overdue|urgent|upcoming|all (default: all)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") || "all";

    const supabase = createServiceClient();

    let query = supabase
      .from("pi_material_requirements")
      .select("*")
      .order("order_by_date", { ascending: true, nullsFirst: false });

    if (filter === "overdue") {
      query = query.eq("urgency_flag", "OVERDUE");
    } else if (filter === "urgent") {
      query = query.in("urgency_flag", ["OVERDUE", "URGENT"]);
    } else if (filter === "upcoming") {
      query = query.eq("urgency_flag", "UPCOMING");
    } else if (filter === "shortfalls") {
      query = query.gt("shortfall_qty", 0);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Aggregate by component (collapse weeks into summary per material)
    const materialMap = new Map<string, {
      component_sku_id: string;
      total_required: number;
      total_shortfall: number;
      total_order_qty: number;
      total_estimated_cost: number;
      earliest_order_by: string | null;
      worst_urgency: string;
      supplier_id: string | null;
      weeks: typeof data;
    }>();

    for (const row of data || []) {
      const existing = materialMap.get(row.component_sku_id);
      if (!existing) {
        materialMap.set(row.component_sku_id, {
          component_sku_id: row.component_sku_id,
          total_required: row.required_qty || 0,
          total_shortfall: row.shortfall_qty || 0,
          total_order_qty: row.order_qty || 0,
          total_estimated_cost: row.estimated_cost || 0,
          earliest_order_by: row.order_by_date,
          worst_urgency: row.urgency_flag || "OK",
          supplier_id: row.supplier_id,
          weeks: [row],
        });
      } else {
        existing.total_required += row.required_qty || 0;
        existing.total_shortfall += row.shortfall_qty || 0;
        existing.total_order_qty += row.order_qty || 0;
        existing.total_estimated_cost += row.estimated_cost || 0;
        if (row.order_by_date && (!existing.earliest_order_by || row.order_by_date < existing.earliest_order_by)) {
          existing.earliest_order_by = row.order_by_date;
        }
        // Worst urgency: OVERDUE > URGENT > UPCOMING > OK
        const urgencyRank: Record<string, number> = { OVERDUE: 3, URGENT: 2, UPCOMING: 1, OK: 0 };
        if ((urgencyRank[row.urgency_flag] || 0) > (urgencyRank[existing.worst_urgency] || 0)) {
          existing.worst_urgency = row.urgency_flag;
        }
        existing.weeks.push(row);
      }
    }

    // Enrich with component names from pi_skus or pi_bom_items
    const componentIds = [...materialMap.keys()];
    const { data: bomNames } = componentIds.length > 0
      ? await supabase.from("pi_bom_items").select("component_sku_id, component_name").in("component_sku_id", componentIds)
      : { data: [] };

    const nameMap = new Map<string, string>();
    for (const b of bomNames || []) {
      if (b.component_sku_id && b.component_name) {
        nameMap.set(b.component_sku_id, b.component_name);
      }
    }

    // Enrich with supplier names
    const supplierIds = [...new Set([...materialMap.values()].map(m => m.supplier_id).filter(Boolean))] as string[];
    const { data: suppliers } = supplierIds.length > 0
      ? await supabase.from("pi_suppliers").select("id, name").in("id", supplierIds)
      : { data: [] };

    const supplierNameMap = new Map((suppliers || []).map(s => [s.id, s.name]));

    // Get current stock for components
    const { data: stockRows } = componentIds.length > 0
      ? await supabase.from("cin7_product_stock").select("cin7_product_id, available").in("cin7_product_id", componentIds)
      : { data: [] };

    const stockMap = new Map<string, number>();
    for (const row of stockRows || []) {
      stockMap.set(row.cin7_product_id, (stockMap.get(row.cin7_product_id) || 0) + (row.available || 0));
    }

    const materials = [...materialMap.values()].map((m) => ({
      ...m,
      component_name: nameMap.get(m.component_sku_id) || m.component_sku_id,
      supplier_name: m.supplier_id ? supplierNameMap.get(m.supplier_id) || null : null,
      current_stock: stockMap.get(m.component_sku_id) || 0,
      has_supplier_config: m.supplier_id !== null,
    }));

    // Sort by urgency then order_by_date
    const urgencySort: Record<string, number> = { OVERDUE: 0, URGENT: 1, UPCOMING: 2, OK: 3 };
    materials.sort((a, b) => {
      const ua = urgencySort[a.worst_urgency] ?? 4;
      const ub = urgencySort[b.worst_urgency] ?? 4;
      if (ua !== ub) return ua - ub;
      if (a.earliest_order_by && b.earliest_order_by) return a.earliest_order_by.localeCompare(b.earliest_order_by);
      return 0;
    });

    // Summary counts
    const summary = {
      total_materials: materials.length,
      overdue: materials.filter(m => m.worst_urgency === "OVERDUE").length,
      urgent: materials.filter(m => m.worst_urgency === "URGENT").length,
      upcoming: materials.filter(m => m.worst_urgency === "UPCOMING").length,
      total_estimated_cost: Math.round(materials.reduce((s, m) => s + m.total_estimated_cost, 0) * 100) / 100,
    };

    return NextResponse.json({ summary, materials });
  } catch (error) {
    console.error("[MRP] GET error:", error);
    return NextResponse.json({ error: "Failed to load material requirements" }, { status: 500 });
  }
}
