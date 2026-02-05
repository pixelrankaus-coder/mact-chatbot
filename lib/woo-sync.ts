/**
 * WooCommerce Data Sync to Supabase
 * TASK MACT #034
 *
 * Mirrors the Cin7 sync pattern for consistency.
 * Syncs orders and customers from WooCommerce to Supabase cache.
 */

import { createServiceClient } from "@/lib/supabase";
import { listWooOrders, getWooCustomers, WooOrder, WooCustomer } from "@/lib/woocommerce";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any;

// WooCommerce status mappings for customer-friendly display
const WOO_STATUS_LABELS: Record<string, string> = {
  pending: "Pending Payment",
  processing: "Processing",
  "on-hold": "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
  failed: "Failed",
  trash: "Deleted",
};

export interface SyncResult {
  success: boolean;
  recordsSynced: number;
  duration: number;
  error?: string;
}

export interface SyncStatus {
  id: string;
  sync_type: string;
  status: string;
  records_synced: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
}

/**
 * Sync all WooCommerce orders to Supabase
 */
export async function syncWooOrders(): Promise<SyncResult> {
  const supabase = createServiceClient() as SupabaseAny;
  const startTime = Date.now();

  // Check WooCommerce credentials first
  const hasWooCredentials = !!(
    process.env.WOOCOMMERCE_URL &&
    process.env.WOOCOMMERCE_CONSUMER_KEY &&
    process.env.WOOCOMMERCE_CONSUMER_SECRET
  );

  console.log("=== WOO ORDERS SYNC START ===");
  console.log("WooCommerce URL:", process.env.WOOCOMMERCE_URL || "NOT SET");
  console.log("WooCommerce Key exists:", !!process.env.WOOCOMMERCE_CONSUMER_KEY);
  console.log("WooCommerce Secret exists:", !!process.env.WOOCOMMERCE_CONSUMER_SECRET);

  if (!hasWooCredentials) {
    console.log("WooCommerce credentials not configured - skipping sync");
    return {
      success: true,
      recordsSynced: 0,
      duration: Date.now() - startTime,
      error: "WooCommerce not configured",
    };
  }

  // Log sync start
  const { data: logEntry } = await supabase
    .from("sync_log")
    .insert({
      sync_type: "woo_orders",
      status: "started",
    })
    .select()
    .single();

  try {
    console.log("Fetching WooCommerce orders...");

    // Fetch all orders from WooCommerce (paginated)
    const allOrders: WooOrder[] = [];
    let page = 1;
    const perPage = 100;
    let hasMore = true;

    while (hasMore) {
      console.log(`Fetching page ${page}...`);
      const { orders, total } = await listWooOrders({
        page,
        per_page: perPage,
      });

      console.log(`Page ${page} returned ${orders.length} orders, total in API: ${total}`);

      if (page === 1 && orders.length > 0) {
        console.log("First order sample:", JSON.stringify(orders[0], null, 2).slice(0, 500));
      }

      allOrders.push(...orders);

      hasMore = orders.length === perPage && allOrders.length < total;
      page++;

      // Safety limit to prevent infinite loops
      if (page > 100) break;
    }

    console.log(`Total fetched: ${allOrders.length} orders from WooCommerce`);

    if (allOrders.length === 0) {
      // Could be no orders or API issue - log it
      console.log("No orders returned from WooCommerce API - store may be empty or API issue");
      const duration = Date.now() - startTime;
      await supabase
        .from("sync_log")
        .update({
          status: "completed",
          records_synced: 0,
          completed_at: new Date().toISOString(),
          duration_ms: duration,
        })
        .eq("id", logEntry?.id);

      return { success: true, recordsSynced: 0, duration };
    }

    // Debug: Log sample dateCreated values
    if (allOrders.length > 0) {
      const sampleOrders = allOrders.slice(0, 3);
      console.log("Sample order dates from API:");
      sampleOrders.forEach((o, i) => {
        console.log(`  Order ${i + 1} (#${o.number}): dateCreated = "${o.dateCreated}"`);
      });
    }

    // Transform to database format
    const records = allOrders.map((order) => {
      // Validate order date - WooCommerce returns ISO format like "2024-05-15T10:30:00"
      const orderDate = order.dateCreated;
      if (!orderDate) {
        console.warn(`Order #${order.number} has no dateCreated, raw_data may have date_created`);
      }

      return {
        woo_id: order.id,
        order_number: order.number,
        status: order.status,
        status_label: WOO_STATUS_LABELS[order.status] || order.status,
        order_date: orderDate || null, // Explicitly set null if missing, don't rely on defaults
        customer_name: order.customerName,
        customer_email: order.customerEmail,
        customer_id: null, // Would need separate lookup
        total: parseFloat(order.total) || 0,
        currency: order.currency || "AUD",
        tracking_number: order.trackingInfo?.trackingNumber || null,
        tracking_provider: order.trackingInfo?.provider || null,
        tracking_url: order.trackingInfo?.trackingUrl || null,
        shipping_total: parseFloat(order.shippingTotal) || 0,
        payment_method: order.paymentMethod || null,
        billing_address: order.billing,
        shipping_address: order.shipping,
        line_items: order.items,
        raw_data: order,
        updated_at: new Date().toISOString(),
      };
    });

    // Batch upsert (500 at a time to avoid payload limits)
    const batchSize = 500;
    let upsertedCount = 0;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const { error } = await supabase
        .from("woo_orders")
        .upsert(batch, { onConflict: "woo_id" });

      if (error) {
        console.error(`Batch ${i / batchSize + 1} upsert error:`, error);
        throw error;
      }

      upsertedCount += batch.length;
      console.log(`Upserted ${upsertedCount}/${records.length} WooCommerce orders`);
    }

    const duration = Date.now() - startTime;

    // Log success
    await supabase
      .from("sync_log")
      .update({
        status: "completed",
        records_synced: records.length,
        completed_at: new Date().toISOString(),
        duration_ms: duration,
      })
      .eq("id", logEntry?.id);

    console.log(`WooCommerce orders sync complete: ${records.length} records in ${duration}ms`);

    return { success: true, recordsSynced: records.length, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    console.error("WooCommerce orders sync failed:", errorMessage);

    // Log failure
    await supabase
      .from("sync_log")
      .update({
        status: "failed",
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
        duration_ms: duration,
      })
      .eq("id", logEntry?.id);

    return { success: false, recordsSynced: 0, duration, error: errorMessage };
  }
}

/**
 * Sync all WooCommerce customers to Supabase
 */
export async function syncWooCustomers(): Promise<SyncResult> {
  const supabase = createServiceClient() as SupabaseAny;
  const startTime = Date.now();

  // Check WooCommerce credentials first
  const hasWooCredentials = !!(
    process.env.WOOCOMMERCE_URL &&
    process.env.WOOCOMMERCE_CONSUMER_KEY &&
    process.env.WOOCOMMERCE_CONSUMER_SECRET
  );

  console.log("=== WOO CUSTOMERS SYNC START ===");
  console.log("WooCommerce credentials configured:", hasWooCredentials);

  if (!hasWooCredentials) {
    console.log("WooCommerce credentials not configured - skipping sync");
    return {
      success: true,
      recordsSynced: 0,
      duration: Date.now() - startTime,
      error: "WooCommerce not configured",
    };
  }

  // Log sync start
  const { data: logEntry } = await supabase
    .from("sync_log")
    .insert({
      sync_type: "woo_customers",
      status: "started",
    })
    .select()
    .single();

  try {
    console.log("Fetching WooCommerce customers...");

    // Fetch all customers from WooCommerce (paginated)
    const allCustomers: WooCustomer[] = [];
    let page = 1;
    const perPage = 100;
    let hasMore = true;

    while (hasMore) {
      console.log(`Fetching customers page ${page}...`);
      const { customers, total } = await getWooCustomers({
        page,
        per_page: perPage,
      });

      console.log(`Page ${page} returned ${customers.length} customers, total in API: ${total}`);

      allCustomers.push(...customers);

      hasMore = customers.length === perPage && allCustomers.length < total;
      page++;

      // Safety limit
      if (page > 100) break;
    }

    console.log(`Total fetched: ${allCustomers.length} customers from WooCommerce`);

    if (allCustomers.length === 0) {
      console.log("No customers returned from WooCommerce API");
      const duration = Date.now() - startTime;
      await supabase
        .from("sync_log")
        .update({
          status: "completed",
          records_synced: 0,
          completed_at: new Date().toISOString(),
          duration_ms: duration,
        })
        .eq("id", logEntry?.id);

      return { success: true, recordsSynced: 0, duration };
    }

    // Transform to database format
    const records = allCustomers.map((customer) => ({
      woo_id: customer.id,
      email: customer.email || null,
      first_name: customer.first_name || null,
      last_name: customer.last_name || null,
      username: customer.username || null,
      phone: customer.billing?.phone || null,
      company: customer.billing?.company || null,
      billing_address: customer.billing,
      shipping_address: customer.shipping,
      orders_count: customer.orders_count || 0,
      total_spent: parseFloat(customer.total_spent) || 0,
      avatar_url: customer.avatar_url || null,
      date_created: customer.date_created,
      raw_data: customer,
      updated_at: new Date().toISOString(),
    }));

    // Batch upsert
    const batchSize = 500;
    let upsertedCount = 0;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const { error } = await supabase
        .from("woo_customers")
        .upsert(batch, { onConflict: "woo_id" });

      if (error) {
        console.error(`Batch ${i / batchSize + 1} upsert error:`, error);
        throw error;
      }

      upsertedCount += batch.length;
      console.log(`Upserted ${upsertedCount}/${records.length} WooCommerce customers`);
    }

    const duration = Date.now() - startTime;

    // Log success
    await supabase
      .from("sync_log")
      .update({
        status: "completed",
        records_synced: records.length,
        completed_at: new Date().toISOString(),
        duration_ms: duration,
      })
      .eq("id", logEntry?.id);

    console.log(`WooCommerce customers sync complete: ${records.length} records in ${duration}ms`);

    return { success: true, recordsSynced: records.length, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    console.error("WooCommerce customers sync failed:", errorMessage);

    // Log failure
    await supabase
      .from("sync_log")
      .update({
        status: "failed",
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
        duration_ms: duration,
      })
      .eq("id", logEntry?.id);

    return { success: false, recordsSynced: 0, duration, error: errorMessage };
  }
}

/**
 * Get the last sync status for a given sync type
 */
export async function getLastWooSyncStatus(syncType: string): Promise<SyncStatus | null> {
  const supabase = createServiceClient() as SupabaseAny;

  const { data } = await supabase
    .from("sync_log")
    .select("*")
    .eq("sync_type", syncType)
    .order("started_at", { ascending: false })
    .limit(1)
    .single();

  return data as SyncStatus | null;
}

/**
 * Get order count from Supabase cache
 */
export async function getWooOrderCount(): Promise<number> {
  const supabase = createServiceClient() as SupabaseAny;

  const { count } = await supabase
    .from("woo_orders")
    .select("*", { count: "exact", head: true });

  return count || 0;
}

/**
 * Get customer count from Supabase cache
 */
export async function getWooCustomerCount(): Promise<number> {
  const supabase = createServiceClient() as SupabaseAny;

  const { count } = await supabase
    .from("woo_customers")
    .select("*", { count: "exact", head: true });

  return count || 0;
}
