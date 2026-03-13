import { NextResponse } from "next/server";
import { runAllProjections } from "@/lib/pi/projection";
import { createServiceClient } from "@/lib/supabase";

/**
 * GET /api/production-intelligence/dashboard
 * Returns aggregated dashboard data: stockout risks, pilot SKU stats, recent forecasts
 */

export async function GET() {
  try {
    const supabase = createServiceClient();

    // Run projections and get pilot SKU info in parallel
    const [projectionsResult, skuResult, forecastResult, syncResult] =
      await Promise.all([
        runAllProjections(),
        supabase
          .from("pi_skus")
          .select("cin7_product_id, sku_code, name, is_pilot, category")
          .eq("is_pilot", true),
        supabase
          .from("pi_forecasts")
          .select("sku_id, week_start, effective_qty")
          .order("week_start", { ascending: true }),
        supabase
          .from("pi_sync_log")
          .select("sync_type, status, completed_at, records_fetched")
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

    const projections = projectionsResult.projections;

    // Compute summary stats
    const atRisk = projections.filter((p) => p.stockout_week !== null);
    const belowSafety = projections.filter((p) =>
      p.weeks.some((w) => w.risk_flag === "STOCKOUT_RISK")
    );
    const totalForecastDemand = projections.reduce((sum, p) => {
      return sum + p.weeks.reduce((wSum, w) => wSum + w.forecast_demand, 0);
    }, 0);

    return NextResponse.json({
      summary: {
        pilot_skus: skuResult.data?.length || 0,
        at_risk_skus: atRisk.length,
        below_safety_skus: belowSafety.length,
        total_12wk_forecast_demand: Math.round(totalForecastDemand),
      },
      projections,
      forecasts: forecastResult.data || [],
      recent_syncs: syncResult.data || [],
    });
  } catch (error) {
    console.error("[PI] Dashboard error:", error);
    return NextResponse.json(
      { error: "Failed to load dashboard" },
      { status: 500 }
    );
  }
}
