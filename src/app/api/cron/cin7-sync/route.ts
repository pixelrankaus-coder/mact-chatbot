import { NextRequest, NextResponse } from "next/server";
import { syncCin7Orders, syncCin7Customers } from "@/lib/cin7-sync";

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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("Starting scheduled Cin7 sync...");
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

    return NextResponse.json({
      success: true,
      orders: ordersResult,
      customers: customersResult,
      totalDuration,
    });
  } catch (error) {
    console.error("Scheduled Cin7 sync failed:", error);
    return NextResponse.json(
      {
        error: "Sync failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Also allow POST for manual testing
export async function POST(request: NextRequest) {
  return GET(request);
}
