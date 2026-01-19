import { NextRequest, NextResponse } from "next/server";
import { syncCin7Orders, syncCin7Customers } from "@/lib/cin7-sync";
import { syncWooOrders, syncWooCustomers } from "@/lib/woo-sync";

/**
 * GET /api/cron/data-sync - Unified scheduled sync endpoint
 * Called by Vercel Cron every 15 minutes
 * Syncs both Cin7 and WooCommerce data to Supabase
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

  console.log("Starting scheduled data sync (Cin7 + WooCommerce)...");
  const startTime = Date.now();

  const results = {
    cin7: {
      orders: { success: false, recordsSynced: 0, duration: 0, error: undefined as string | undefined },
      customers: { success: false, recordsSynced: 0, duration: 0, error: undefined as string | undefined },
    },
    woocommerce: {
      orders: { success: false, recordsSynced: 0, duration: 0, error: undefined as string | undefined },
      customers: { success: false, recordsSynced: 0, duration: 0, error: undefined as string | undefined },
    },
  };

  try {
    // Run Cin7 and WooCommerce syncs in parallel
    // Each provider syncs orders and customers in parallel
    const [cin7Results, wooResults] = await Promise.all([
      // Cin7 sync
      Promise.all([
        syncCin7Orders().catch((e) => ({ success: false, recordsSynced: 0, duration: 0, error: e.message })),
        syncCin7Customers().catch((e) => ({ success: false, recordsSynced: 0, duration: 0, error: e.message })),
      ]),
      // WooCommerce sync
      Promise.all([
        syncWooOrders().catch((e) => ({ success: false, recordsSynced: 0, duration: 0, error: e.message })),
        syncWooCustomers().catch((e) => ({ success: false, recordsSynced: 0, duration: 0, error: e.message })),
      ]),
    ]);

    results.cin7.orders = cin7Results[0];
    results.cin7.customers = cin7Results[1];
    results.woocommerce.orders = wooResults[0];
    results.woocommerce.customers = wooResults[1];

    const totalDuration = Date.now() - startTime;

    console.log("Scheduled data sync complete:", {
      cin7: results.cin7,
      woocommerce: results.woocommerce,
      totalDuration: `${totalDuration}ms`,
    });

    // Count successes and failures
    const allResults = [
      results.cin7.orders,
      results.cin7.customers,
      results.woocommerce.orders,
      results.woocommerce.customers,
    ];
    const successes = allResults.filter((r) => r.success).length;
    const failures = allResults.filter((r) => !r.success).length;

    if (failures === 4) {
      return NextResponse.json(
        {
          error: "All syncs failed",
          results,
          totalDuration,
        },
        { status: 500 }
      );
    }

    if (failures > 0) {
      return NextResponse.json(
        {
          warning: `Partial sync failure (${successes}/4 succeeded)`,
          results,
          totalDuration,
        },
        { status: 207 }
      );
    }

    return NextResponse.json({
      success: true,
      results,
      totalDuration,
    });
  } catch (error) {
    console.error("Scheduled data sync failed:", error);
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
