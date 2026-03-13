import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

/**
 * GET /api/production-intelligence/skus — List pilot SKUs
 * PATCH /api/production-intelligence/skus — Toggle pilot status
 */
export async function GET() {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("pi_skus")
      .select("*")
      .order("is_pilot", { ascending: false })
      .order("name", { ascending: true })
      .limit(2000);

    if (error) {
      if (error.code === "42P01" || error.code === "PGRST205") {
        return NextResponse.json({ skus: [] });
      }
      throw error;
    }

    return NextResponse.json({ skus: data || [] });
  } catch (error) {
    console.error("[PI] SKUs error:", error);
    return NextResponse.json({ error: "Failed to fetch SKUs" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();
    const { cin7_product_id, is_pilot } = body;

    if (!cin7_product_id) {
      return NextResponse.json({ error: "cin7_product_id required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("pi_skus")
      .update({ is_pilot: !!is_pilot, updated_at: new Date().toISOString() })
      .eq("cin7_product_id", cin7_product_id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PI] SKU update error:", error);
    return NextResponse.json({ error: "Failed to update SKU" }, { status: 500 });
  }
}
