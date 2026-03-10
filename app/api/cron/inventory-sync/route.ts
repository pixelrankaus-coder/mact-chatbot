import { NextRequest, NextResponse } from "next/server";
import { syncInventory } from "@/lib/cin7-product-sync";
import { logInfo, logError } from "@/lib/logger";

/**
 * GET /api/cron/inventory-sync
 * Syncs Cin7 products, stock levels, and locations to Supabase
 * Called by Vercel Cron every 15 minutes alongside data-sync
 */
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isDev = process.env.NODE_ENV === "development";

  if (!isDev && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    const results = await syncInventory();
    const duration = Date.now() - startTime;

    const totalSynced =
      results.locations.synced + results.products.synced + results.stock.synced;
    const totalErrors =
      results.locations.errors + results.products.errors + results.stock.errors;

    if (totalSynced > 0) {
      logInfo(
        "sync",
        `Inventory sync: ${results.products.synced} products, ${results.stock.synced} stock records, ${results.locations.synced} locations (${duration}ms)`,
        {
          path: "/api/cron/inventory-sync",
          method: "GET",
          status_code: 200,
          duration_ms: duration,
          metadata: results,
        }
      );
    }

    if (totalErrors > 0) {
      logError(
        "sync",
        `Inventory sync errors: ${totalErrors} failures (${duration}ms)`,
        {
          path: "/api/cron/inventory-sync",
          method: "GET",
          status_code: 207,
          duration_ms: duration,
          metadata: results,
        }
      );
    }

    return NextResponse.json({
      success: totalErrors === 0,
      results,
      duration,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : "Unknown error";

    logError("sync", `Inventory sync crashed: ${errorMsg}`, {
      path: "/api/cron/inventory-sync",
      method: "GET",
      status_code: 500,
      duration_ms: duration,
    });

    return NextResponse.json(
      { error: "Inventory sync failed", message: errorMsg },
      { status: 500 }
    );
  }
}

// Allow POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request);
}
