import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

/**
 * GET /api/production-intelligence/suppliers/[id] — Supplier detail with material mappings
 * PATCH /api/production-intelligence/suppliers/[id] — Update supplier
 * DELETE /api/production-intelligence/suppliers/[id] — Deactivate supplier
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();

    const { data: supplier, error } = await supabase
      .from("pi_suppliers")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }

    // Get material mappings
    const { data: materials } = await supabase
      .from("pi_material_suppliers")
      .select("*")
      .eq("supplier_id", id);

    // Enrich with material names
    const skuIds = (materials || []).map((m) => m.sku_id);
    const { data: bomNames } = skuIds.length > 0
      ? await supabase
          .from("pi_bom_items")
          .select("component_sku_id, component_name")
          .in("component_sku_id", skuIds)
      : { data: [] };

    const nameMap = new Map<string, string>();
    for (const b of bomNames || []) {
      if (b.component_sku_id && b.component_name) {
        nameMap.set(b.component_sku_id, b.component_name);
      }
    }

    const enrichedMaterials = (materials || []).map((m) => ({
      ...m,
      material_name: nameMap.get(m.sku_id) || m.sku_id,
    }));

    return NextResponse.json({ supplier, materials: enrichedMaterials });
  } catch (error) {
    console.error("[Suppliers] GET detail error:", error);
    return NextResponse.json({ error: "Failed to load supplier" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const supabase = createServiceClient();

    // Update supplier fields
    if (body.supplier) {
      const { error } = await supabase
        .from("pi_suppliers")
        .update({
          ...body.supplier,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    // Upsert material mappings
    if (body.materials && Array.isArray(body.materials)) {
      for (const mat of body.materials) {
        await supabase
          .from("pi_material_suppliers")
          .upsert(
            {
              sku_id: mat.sku_id,
              supplier_id: id,
              is_preferred: mat.is_preferred ?? true,
              lead_time_days: mat.lead_time_days || 14,
              moq: mat.moq || null,
              order_multiple: mat.order_multiple || null,
              unit_cost: mat.unit_cost || null,
              notes: mat.notes || null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "sku_id,supplier_id" }
          );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Suppliers] PATCH error:", error);
    return NextResponse.json({ error: "Failed to update supplier" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();

    // Soft delete — deactivate
    const { error } = await supabase
      .from("pi_suppliers")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Suppliers] DELETE error:", error);
    return NextResponse.json({ error: "Failed to deactivate supplier" }, { status: 500 });
  }
}
