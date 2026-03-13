import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

/**
 * GET /api/production-intelligence/suppliers — List all suppliers
 * POST /api/production-intelligence/suppliers — Create a supplier
 */
export async function GET() {
  try {
    const supabase = createServiceClient();

    const { data: suppliers, error } = await supabase
      .from("pi_suppliers")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get material counts per supplier
    const supplierIds = (suppliers || []).map((s) => s.id);
    const { data: mappings } = supplierIds.length > 0
      ? await supabase
          .from("pi_material_suppliers")
          .select("supplier_id")
          .in("supplier_id", supplierIds)
      : { data: [] };

    const countMap = new Map<string, number>();
    for (const m of mappings || []) {
      countMap.set(m.supplier_id, (countMap.get(m.supplier_id) || 0) + 1);
    }

    const enriched = (suppliers || []).map((s) => ({
      ...s,
      material_count: countMap.get(s.id) || 0,
    }));

    return NextResponse.json({ suppliers: enriched });
  } catch (error) {
    console.error("[Suppliers] GET error:", error);
    return NextResponse.json({ error: "Failed to load suppliers" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("pi_suppliers")
      .insert({
        name: body.name,
        contact_name: body.contact_name || null,
        email: body.email || null,
        phone: body.phone || null,
        notes: body.notes || null,
        is_active: body.is_active ?? true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ supplier: data }, { status: 201 });
  } catch (error) {
    console.error("[Suppliers] POST error:", error);
    return NextResponse.json({ error: "Failed to create supplier" }, { status: 500 });
  }
}
