import { NextRequest, NextResponse } from "next/server";
import { syncStockSnapshot, syncSalesHistory } from "@/lib/pi/sync";
import { runAllForecasts } from "@/lib/pi/forecast";
import { runAllProjections } from "@/lib/pi/projection";
import { runMRPForAllPilotSkus } from "@/lib/pi/mrp-engine";
import { runScheduler } from "@/lib/pi/scheduler";

/**
 * POST /api/cron/pi-nightly
 * Nightly Production Intelligence pipeline:
 *   1. Sync stock snapshots (DB-to-DB from cin7_product_stock)
 *   2. Sync sales history (DB-to-DB from cin7_order_items)
 *   3. Run demand forecasts (weighted moving average)
 *   4. Run stock projections (12-week outlook, persist to pi_stock_projections)
 *   5. Run MRP engine (explode BOMs, calculate shortfalls + order-by dates)
 *   6. Run production scheduler (assign runs to days based on rules)
 *
 * Scheduled: daily at 2am AEST via Vercel cron
 */
export async function POST(request: NextRequest) {
  // Verify cron secret (bypassed in development)
  const authHeader = request.headers.get("authorization");
  if (
    process.env.NODE_ENV !== "development" &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, unknown> = {};
  const startTime = Date.now();

  try {
    // Step 1: Sync stock snapshots
    console.log("[PI Nightly] Step 1: Syncing stock snapshots...");
    const stockResult = await syncStockSnapshot();
    results.stock_snapshot = stockResult;

    // Step 2: Sync sales history
    console.log("[PI Nightly] Step 2: Syncing sales history...");
    const salesResult = await syncSalesHistory();
    results.sales_history = salesResult;

    // Step 3: Run demand forecasts
    console.log("[PI Nightly] Step 3: Running demand forecasts...");
    const forecastResult = await runAllForecasts();
    results.forecasts = {
      skus: forecastResult.skus,
      forecast_rows: forecastResult.forecasts,
      error: forecastResult.error,
    };

    // Step 4: Run stock projections
    console.log("[PI Nightly] Step 4: Running stock projections...");
    const projectionResult = await runAllProjections();
    results.projections = {
      skus: projectionResult.projections.length,
      at_risk: projectionResult.projections.filter((p) => p.stockout_week !== null).length,
      error: projectionResult.error,
    };

    // Step 5: Run MRP engine
    console.log("[PI Nightly] Step 5: Running MRP engine...");
    const mrpResult = await runMRPForAllPilotSkus();
    results.mrp = mrpResult;

    // Step 6: Run production scheduler
    console.log("[PI Nightly] Step 6: Running production scheduler...");
    const schedulerResult = await runScheduler();
    results.scheduler = schedulerResult;

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[PI Nightly] Complete in ${elapsed}s`);

    return NextResponse.json({
      success: true,
      elapsed_seconds: Number(elapsed),
      results,
    });
  } catch (error) {
    console.error("[PI Nightly] Pipeline error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        results,
      },
      { status: 500 }
    );
  }
}

// Also support GET for Vercel cron (Vercel crons send GET requests)
export async function GET(request: NextRequest) {
  return POST(request);
}
