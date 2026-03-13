import { NextRequest, NextResponse } from "next/server";
import { forecastSku, runAllForecasts } from "@/lib/pi/forecast";
import { createServiceClient } from "@/lib/supabase";

/**
 * GET /api/production-intelligence/forecast — Get forecasts for all pilot SKUs
 * GET /api/production-intelligence/forecast?sku_id=xxx — Get forecast for one SKU
 * POST /api/production-intelligence/forecast — Run forecast generation
 * PATCH /api/production-intelligence/forecast — Override a forecast week
 */

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const skuId = searchParams.get("sku_id");

    if (skuId) {
      // Single SKU forecast
      const { data: sku } = await supabase
        .from("pi_skus")
        .select("cin7_product_id, sku_code, name")
        .eq("cin7_product_id", skuId)
        .single();

      if (!sku) {
        return NextResponse.json({ error: "SKU not found" }, { status: 404 });
      }

      const result = await forecastSku(sku.cin7_product_id, sku.sku_code);
      return NextResponse.json({ sku, ...result });
    }

    // All pilot SKU forecasts from DB
    const { data: forecasts } = await supabase
      .from("pi_forecasts")
      .select("sku_id, week_start, forecast_qty, override_qty, effective_qty, method, generated_at")
      .order("sku_id")
      .order("week_start", { ascending: true });

    return NextResponse.json({ forecasts: forecasts || [] });
  } catch (error) {
    console.error("[PI] Forecast GET error:", error);
    return NextResponse.json({ error: "Failed to fetch forecasts" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const result = await runAllForecasts();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[PI] Forecast run error:", error);
    return NextResponse.json({ error: "Failed to run forecasts" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();
    const { sku_id, week_start, override_qty } = body;

    if (!sku_id || !week_start) {
      return NextResponse.json({ error: "sku_id and week_start required" }, { status: 400 });
    }

    // Set or clear override (null clears it, reverts to forecast)
    const { error } = await supabase
      .from("pi_forecasts")
      .update({
        override_qty: override_qty === null ? null : Number(override_qty),
        updated_at: new Date().toISOString(),
      })
      .eq("sku_id", sku_id)
      .eq("week_start", week_start);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PI] Forecast override error:", error);
    return NextResponse.json({ error: "Failed to update forecast" }, { status: 500 });
  }
}
