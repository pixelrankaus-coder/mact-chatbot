import { NextRequest, NextResponse } from "next/server";
import { syncCin7Orders, syncCin7Customers } from "@/lib/cin7-sync";
import { syncWooOrders, syncWooCustomers, SyncResult } from "@/lib/woo-sync";
import { syncWooOrdersWithLogging, syncWooCustomersWithLogging } from "@/lib/woo-sync-db";
import { createServiceClient } from "@/lib/supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any;

// Sync frequency intervals in milliseconds
const SYNC_INTERVALS: Record<string, number> = {
  "15min": 15 * 60 * 1000,
  "1hour": 60 * 60 * 1000,
  "6hours": 6 * 60 * 60 * 1000,
  "daily": 24 * 60 * 60 * 1000,
  "manual": Infinity, // Never auto-sync
};

/**
 * Check if sync should run based on frequency setting
 */
function shouldSync(frequency: string, lastSyncAt: string | null): boolean {
  // Manual mode = never auto-sync
  if (frequency === "manual") return false;

  // No last sync = always sync
  if (!lastSyncAt) return true;

  const lastSyncTime = new Date(lastSyncAt).getTime();
  const now = Date.now();
  const elapsed = now - lastSyncTime;
  const interval = SYNC_INTERVALS[frequency] || SYNC_INTERVALS["1hour"];

  return elapsed >= interval;
}

/**
 * Try DB-based WooCommerce sync first, fall back to env var sync
 */
async function syncWooOrdersWithFallback(): Promise<SyncResult> {
  const supabase = createServiceClient() as SupabaseAny;

  // Check if WooCommerce is configured in DB
  const { data } = await supabase
    .from("integration_settings")
    .select("is_enabled")
    .eq("integration_type", "woocommerce")
    .single();

  if (data?.is_enabled) {
    // Use DB-based sync (no-op logging for cron)
    const noOpLog = () => Promise.resolve();
    return syncWooOrdersWithLogging(supabase, noOpLog);
  }

  // Fall back to env var based sync
  return syncWooOrders();
}

async function syncWooCustomersWithFallback(): Promise<SyncResult> {
  const supabase = createServiceClient() as SupabaseAny;

  // Check if WooCommerce is configured in DB
  const { data } = await supabase
    .from("integration_settings")
    .select("is_enabled")
    .eq("integration_type", "woocommerce")
    .single();

  if (data?.is_enabled) {
    // Use DB-based sync (no-op logging for cron)
    const noOpLog = () => Promise.resolve();
    return syncWooCustomersWithLogging(supabase, noOpLog);
  }

  // Fall back to env var based sync
  return syncWooCustomers();
}

/**
 * GET /api/cron/data-sync - Unified scheduled sync endpoint
 * Called by Vercel Cron every 15 minutes
 * Syncs both Cin7 and WooCommerce data to Supabase
 * Respects sync frequency settings (TASK #039)
 */
export async function GET(request: NextRequest) {
  const supabase = createServiceClient() as SupabaseAny;

  // Verify cron secret for security
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // In development, allow without secret
  const isDev = process.env.NODE_ENV === "development";

  if (!isDev && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn("Unauthorized cron access attempt");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check sync frequency settings for both integrations
  const { data: cin7Config } = await supabase
    .from("integration_settings")
    .select("settings, is_enabled")
    .eq("integration_type", "cin7")
    .single();

  const { data: wooConfig } = await supabase
    .from("integration_settings")
    .select("settings, is_enabled")
    .eq("integration_type", "woocommerce")
    .single();

  // Determine if each integration should sync
  const cin7ShouldSync = cin7Config?.is_enabled && shouldSync(
    cin7Config?.settings?.sync_frequency || "1hour",
    cin7Config?.settings?.last_sync_at
  );
  const wooShouldSync = wooConfig?.is_enabled && shouldSync(
    wooConfig?.settings?.sync_frequency || "1hour",
    wooConfig?.settings?.last_sync_at
  );

  // Skip entirely if nothing should sync
  if (!cin7ShouldSync && !wooShouldSync) {
    console.log("Scheduled data sync skipped: Not due yet based on frequency settings");
    return NextResponse.json({
      skipped: true,
      reason: "Not due yet based on frequency settings",
      cin7: {
        frequency: cin7Config?.settings?.sync_frequency || "1hour",
        lastSync: cin7Config?.settings?.last_sync_at || null,
        shouldSync: cin7ShouldSync,
      },
      woo: {
        frequency: wooConfig?.settings?.sync_frequency || "1hour",
        lastSync: wooConfig?.settings?.last_sync_at || null,
        shouldSync: wooShouldSync,
      },
    });
  }

  console.log("Starting scheduled data sync (Cin7 + WooCommerce)...", {
    cin7ShouldSync,
    wooShouldSync,
  });
  const startTime = Date.now();

  const results = {
    cin7: {
      orders: { success: false, recordsSynced: 0, duration: 0, error: undefined as string | undefined, skipped: false },
      customers: { success: false, recordsSynced: 0, duration: 0, error: undefined as string | undefined, skipped: false },
    },
    woocommerce: {
      orders: { success: false, recordsSynced: 0, duration: 0, error: undefined as string | undefined, skipped: false },
      customers: { success: false, recordsSynced: 0, duration: 0, error: undefined as string | undefined, skipped: false },
    },
  };

  try {
    // Run syncs based on frequency settings
    const syncPromises: Promise<void>[] = [];

    // Cin7 sync (incremental mode for cron)
    if (cin7ShouldSync) {
      syncPromises.push(
        Promise.all([
          syncCin7Orders().catch((e) => ({ success: false, recordsSynced: 0, duration: 0, error: e.message })),
          syncCin7Customers().catch((e) => ({ success: false, recordsSynced: 0, duration: 0, error: e.message })),
        ]).then(([orders, customers]) => {
          results.cin7.orders = orders;
          results.cin7.customers = customers;
          // Update last sync time
          supabase
            .from("integration_settings")
            .update({
              settings: {
                ...cin7Config?.settings,
                last_sync_at: new Date().toISOString(),
                orders_cached: orders.recordsSynced || cin7Config?.settings?.orders_cached,
                customers_cached: customers.recordsSynced || cin7Config?.settings?.customers_cached,
              },
            })
            .eq("integration_type", "cin7")
            .then(() => {});
        })
      );
    } else {
      results.cin7.orders.skipped = true;
      results.cin7.customers.skipped = true;
    }

    // WooCommerce sync
    if (wooShouldSync) {
      syncPromises.push(
        Promise.all([
          syncWooOrdersWithFallback().catch((e) => ({ success: false, recordsSynced: 0, duration: 0, error: e.message })),
          syncWooCustomersWithFallback().catch((e) => ({ success: false, recordsSynced: 0, duration: 0, error: e.message })),
        ]).then(([orders, customers]) => {
          results.woocommerce.orders = orders;
          results.woocommerce.customers = customers;
          // Update last sync time
          supabase
            .from("integration_settings")
            .update({
              settings: {
                ...wooConfig?.settings,
                last_sync_at: new Date().toISOString(),
              },
            })
            .eq("integration_type", "woocommerce")
            .then(() => {});
        })
      );
    } else {
      results.woocommerce.orders.skipped = true;
      results.woocommerce.customers.skipped = true;
    }

    // Wait for all syncs to complete
    await Promise.all(syncPromises);

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
