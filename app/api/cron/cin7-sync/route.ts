import { NextRequest, NextResponse } from "next/server";
import { syncCin7Orders, syncCin7Customers } from "@/lib/cin7-sync";
import { logInfo, logError, logWarn } from "@/lib/logger";

/**
 * GET /api/cron/cin7-sync - Scheduled sync endpoint
 * Called by Vercel Cron every 15 minutes
 */
export async function GET(request: NextRequest) {
  // Verify cron secret for security
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // In development, allow without secret
  const isDev = process.env.NODE_ENV === "development";

  if (!isDev && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn("Unauthorized cron access attempt");
    logWarn("cron", "Unauthorized Cin7 cron access attempt", {
      path: "/api/cron/cin7-sync", method: "GET", status_code: 401,
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  logInfo("sync", "Cin7 sync started", { path: "/api/cron/cin7-sync", method: "GET" });
  const startTime = Date.now();

  try {
    // Run both syncs
    const [ordersResult, customersResult] = await Promise.all([
      syncCin7Orders(),
      syncCin7Customers(),
    ]);

    const totalDuration = Date.now() - startTime;

    console.log("Scheduled Cin7 sync complete:", {
      orders: ordersResult,
      customers: customersResult,
      totalDuration: `${totalDuration}ms`,
    });

    logInfo("sync", `Cin7 sync completed: ${ordersResult.recordsSynced} orders, ${customersResult.recordsSynced} customers (${totalDuration}ms)`, {
      path: "/api/cron/cin7-sync",
      method: "GET",
      status_code: 200,
      duration_ms: totalDuration,
      metadata: { orders: ordersResult, customers: customersResult },
    });

    return NextResponse.json({
      success: true,
      orders: ordersResult,
      customers: customersResult,
      totalDuration,
    });
  } catch (error) {
    console.error("Scheduled Cin7 sync failed:", error);
    const totalDuration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : "Unknown error";

    logError("sync", `Cin7 sync failed: ${errorMsg} (${totalDuration}ms)`, {
      path: "/api/cron/cin7-sync",
      method: "GET",
      status_code: 500,
      duration_ms: totalDuration,
      metadata: { error: errorMsg },
    });

    return NextResponse.json(
      {
        error: "Sync failed",
        message: errorMsg,
      },
      { status: 500 }
    );
  }
}

// Also allow POST for manual testing
export async function POST(request: NextRequest) {
  return GET(request);
}
