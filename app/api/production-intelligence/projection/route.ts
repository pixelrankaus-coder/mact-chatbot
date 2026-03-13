import { NextRequest, NextResponse } from "next/server";
import { projectSku, runAllProjections } from "@/lib/pi/projection";
import { forecastSku } from "@/lib/pi/forecast";
import { createServiceClient } from "@/lib/supabase";

/**
 * GET /api/production-intelligence/projection — Get projections for all pilot SKUs
 * GET /api/production-intelligence/projection?sku_id=xxx — Get projection for one SKU
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const skuId = searchParams.get("sku_id");

    if (skuId) {
      // Single SKU projection
      const supabase = createServiceClient();
      const { data: sku } = await supabase
        .from("pi_skus")
        .select("cin7_product_id, sku_code, name, safety_stock_weeks")
        .eq("cin7_product_id", skuId)
        .single();

      if (!sku) {
        return NextResponse.json({ error: "SKU not found" }, { status: 404 });
      }

      // Dynamic safety stock: weeks × avg weekly demand
      const safetyWeeks = sku.safety_stock_weeks ?? 2.0;
      const { weeklyAvg } = await forecastSku(sku.cin7_product_id, sku.sku_code);
      const safetyStockUnits = Math.round(safetyWeeks * weeklyAvg * 100) / 100;

      const projection = await projectSku(
        sku.cin7_product_id,
        sku.sku_code,
        sku.name,
        safetyStockUnits
      );
      return NextResponse.json({ projection });
    }

    // All pilot SKU projections
    const { projections, error } = await runAllProjections();

    if (error) {
      return NextResponse.json({ projections: [], error });
    }

    return NextResponse.json({ projections });
  } catch (error) {
    console.error("[PI] Projection error:", error);
    return NextResponse.json(
      { error: "Failed to generate projections" },
      { status: 500 }
    );
  }
}
