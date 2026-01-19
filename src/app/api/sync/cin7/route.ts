import { NextRequest, NextResponse } from "next/server";
import {
  syncCin7Orders,
  syncCin7Customers,
  getLastSyncStatus,
  getCin7OrderCount,
  getCin7CustomerCount,
} from "@/lib/cin7-sync";

/**
 * GET /api/sync/cin7 - Get sync status
 */
export async function GET() {
  try {
    const [ordersStatus, customersStatus, orderCount, customerCount] = await Promise.all([
      getLastSyncStatus("cin7_orders"),
      getLastSyncStatus("cin7_customers"),
      getCin7OrderCount(),
      getCin7CustomerCount(),
    ]);

    return NextResponse.json({
      orders: {
        lastSync: ordersStatus,
        cachedCount: orderCount,
      },
      customers: {
        lastSync: customersStatus,
        cachedCount: customerCount,
      },
    });
  } catch (error) {
    console.error("Failed to get sync status:", error);
    return NextResponse.json(
      { error: "Failed to get sync status" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sync/cin7 - Trigger sync
 * Body: { type: 'orders' | 'customers' | 'all' }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type } = body;

    if (!type || !["orders", "customers", "all"].includes(type)) {
      return NextResponse.json(
        { error: "Invalid sync type. Must be 'orders', 'customers', or 'all'" },
        { status: 400 }
      );
    }

    const results: {
      orders?: { success: boolean; recordsSynced: number; duration: number; error?: string };
      customers?: { success: boolean; recordsSynced: number; duration: number; error?: string };
    } = {};

    if (type === "orders" || type === "all") {
      console.log("Starting orders sync...");
      results.orders = await syncCin7Orders();
    }

    if (type === "customers" || type === "all") {
      console.log("Starting customers sync...");
      results.customers = await syncCin7Customers();
    }

    // Check if any sync failed
    const ordersFailed = results.orders && !results.orders.success;
    const customersFailed = results.customers && !results.customers.success;

    if (ordersFailed && customersFailed) {
      return NextResponse.json(
        {
          error: "Both syncs failed",
          results,
        },
        { status: 500 }
      );
    }

    if (ordersFailed || customersFailed) {
      return NextResponse.json(
        {
          warning: "Partial sync failure",
          results,
        },
        { status: 207 } // Multi-Status
      );
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error("Sync trigger failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}
