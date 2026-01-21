/**
 * WooCommerce Data Sync with DB Credentials
 * TASK MACT #035
 *
 * Like woo-sync.ts but reads credentials from integration_settings table
 * and supports real-time logging callbacks for SSE streaming.
 */

import WooCommerceRestApi from "@woocommerce/woocommerce-rest-api";
import { SyncResult } from "./woo-sync";

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

export type LogLevel = "info" | "warn" | "error" | "success";
export type LogCallback = (
  level: LogLevel,
  message: string,
  details?: Record<string, unknown>
) => Promise<void> | void;

interface WooCommerceSettings {
  url: string;
  consumer_key: string;
  consumer_secret: string;
}

/**
 * Get WooCommerce credentials from database
 */
async function getWooCredentialsFromDB(
  supabase: SupabaseAny
): Promise<WooCommerceSettings | null> {
  const { data, error } = await supabase
    .from("integration_settings")
    .select("settings, is_enabled")
    .eq("integration_type", "woocommerce")
    .single();

  if (error || !data) {
    return null;
  }

  if (!data.is_enabled) {
    return null;
  }

  const settings = data.settings as WooCommerceSettings;

  if (!settings.url || !settings.consumer_key || !settings.consumer_secret) {
    return null;
  }

  return settings;
}

/**
 * Create WooCommerce API client with DB credentials
 */
function createWooClient(settings: WooCommerceSettings) {
  return new WooCommerceRestApi({
    url: settings.url,
    consumerKey: settings.consumer_key,
    consumerSecret: settings.consumer_secret,
    version: "wc/v3",
  });
}

/**
 * Transform raw WooCommerce order to database format
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformOrderForDB(order: any) {
  const metaData = order.meta_data || [];
  const trackingMeta = metaData.find(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (m: any) => m.key === "_wc_shipment_tracking_items" || m.key === "tracking_number"
  );

  let trackingNumber = null;
  let trackingProvider = null;
  let trackingUrl = null;

  if (trackingMeta?.value) {
    const trackingData = Array.isArray(trackingMeta.value)
      ? trackingMeta.value[0]
      : trackingMeta.value;
    if (typeof trackingData === "object" && trackingData !== null) {
      trackingNumber = trackingData.tracking_number || trackingData.number || null;
      trackingProvider = trackingData.tracking_provider || trackingData.provider || null;
      trackingUrl = trackingData.tracking_link || trackingData.url || null;
    }
  }

  return {
    woo_id: order.id,
    order_number: String(order.number || order.id),
    status: order.status,
    status_label: WOO_STATUS_LABELS[order.status] || order.status,
    order_date: order.date_created,
    customer_name: `${order.billing?.first_name || ""} ${order.billing?.last_name || ""}`.trim(),
    customer_email: order.billing?.email || null,
    customer_id: order.customer_id || null,
    total: parseFloat(order.total) || 0,
    currency: order.currency || "AUD",
    tracking_number: trackingNumber,
    tracking_provider: trackingProvider,
    tracking_url: trackingUrl,
    shipping_total: parseFloat(order.shipping_total) || 0,
    payment_method: order.payment_method_title || null,
    billing_address: order.billing,
    shipping_address: order.shipping,
    line_items: order.line_items?.map((item: { name: string; quantity: number; price: string; total: string }) => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      total: item.total,
    })),
    raw_data: order,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Transform raw WooCommerce customer to database format
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformCustomerForDB(customer: any) {
  return {
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
  };
}

/**
 * Sync WooCommerce orders with logging callbacks
 */
export async function syncWooOrdersWithLogging(
  supabase: SupabaseAny,
  log: LogCallback
): Promise<SyncResult> {
  const startTime = Date.now();

  // Get credentials from database
  await log("info", "Checking WooCommerce credentials...");
  const credentials = await getWooCredentialsFromDB(supabase);

  if (!credentials) {
    await log("warn", "WooCommerce not configured or disabled in settings");
    return {
      success: true,
      recordsSynced: 0,
      duration: Date.now() - startTime,
      error: "WooCommerce not configured",
    };
  }

  await log("success", `Connected to ${credentials.url}`);

  // Log sync start
  const { data: logEntry } = await supabase
    .from("sync_log")
    .insert({
      sync_type: "woo_orders",
      status: "started",
    })
    .select()
    .single();

  const api = createWooClient(credentials);

  try {
    await log("info", "Fetching orders from WooCommerce...");

    // Fetch all orders (paginated)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allOrders: any[] = [];
    let page = 1;
    const perPage = 100;
    let hasMore = true;

    while (hasMore) {
      await log("info", `Fetching page ${page}...`);

      const response = await api.get("orders", {
        page,
        per_page: perPage,
        orderby: "date",
        order: "desc",
      });

      const orders = response.data || [];
      const total = parseInt(response.headers?.["x-wp-total"] || "0", 10);

      await log("info", `Page ${page}: ${orders.length} orders (total: ${total})`);

      allOrders.push(...orders);

      hasMore = orders.length === perPage && allOrders.length < total;
      page++;

      // Safety limit
      if (page > 100) {
        await log("warn", "Reached page limit (100 pages)");
        break;
      }
    }

    await log("success", `Fetched ${allOrders.length} orders total`);

    if (allOrders.length === 0) {
      await log("info", "No orders to sync");
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

    // Transform orders
    await log("info", "Transforming order data...");
    const records = allOrders.map(transformOrderForDB);

    // Batch upsert
    const batchSize = 500;
    let upsertedCount = 0;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      await log("info", `Upserting batch ${Math.floor(i / batchSize) + 1}...`);

      const { error } = await supabase
        .from("woo_orders")
        .upsert(batch, { onConflict: "woo_id" });

      if (error) {
        await log("error", `Batch upsert failed: ${error.message}`);
        throw error;
      }

      upsertedCount += batch.length;
      await log("success", `Upserted ${upsertedCount}/${records.length} orders`);
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

    await log("success", `Orders sync complete: ${records.length} records in ${(duration / 1000).toFixed(1)}s`);

    return { success: true, recordsSynced: records.length, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    await log("error", `Sync failed: ${errorMessage}`);

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
 * Sync WooCommerce customers with logging callbacks
 */
export async function syncWooCustomersWithLogging(
  supabase: SupabaseAny,
  log: LogCallback
): Promise<SyncResult> {
  const startTime = Date.now();

  // Get credentials from database
  await log("info", "Checking WooCommerce credentials...");
  const credentials = await getWooCredentialsFromDB(supabase);

  if (!credentials) {
    await log("warn", "WooCommerce not configured or disabled in settings");
    return {
      success: true,
      recordsSynced: 0,
      duration: Date.now() - startTime,
      error: "WooCommerce not configured",
    };
  }

  await log("success", `Connected to ${credentials.url}`);

  // Log sync start
  const { data: logEntry } = await supabase
    .from("sync_log")
    .insert({
      sync_type: "woo_customers",
      status: "started",
    })
    .select()
    .single();

  const api = createWooClient(credentials);

  try {
    await log("info", "Fetching customers from WooCommerce...");

    // Fetch all customers (paginated)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allCustomers: any[] = [];
    let page = 1;
    const perPage = 100;
    let hasMore = true;

    while (hasMore) {
      await log("info", `Fetching page ${page}...`);

      const response = await api.get("customers", {
        page,
        per_page: perPage,
        orderby: "registered_date",
        order: "desc",
      });

      const customers = response.data || [];
      const total = parseInt(response.headers?.["x-wp-total"] || "0", 10);

      await log("info", `Page ${page}: ${customers.length} customers (total: ${total})`);

      allCustomers.push(...customers);

      hasMore = customers.length === perPage && allCustomers.length < total;
      page++;

      // Safety limit
      if (page > 100) {
        await log("warn", "Reached page limit (100 pages)");
        break;
      }
    }

    await log("success", `Fetched ${allCustomers.length} customers total`);

    if (allCustomers.length === 0) {
      await log("info", "No customers to sync");
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

    // Transform customers
    await log("info", "Transforming customer data...");
    const records = allCustomers.map(transformCustomerForDB);

    // Batch upsert
    const batchSize = 500;
    let upsertedCount = 0;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      await log("info", `Upserting batch ${Math.floor(i / batchSize) + 1}...`);

      const { error } = await supabase
        .from("woo_customers")
        .upsert(batch, { onConflict: "woo_id" });

      if (error) {
        await log("error", `Batch upsert failed: ${error.message}`);
        throw error;
      }

      upsertedCount += batch.length;
      await log("success", `Upserted ${upsertedCount}/${records.length} customers`);
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

    await log("success", `Customers sync complete: ${records.length} records in ${(duration / 1000).toFixed(1)}s`);

    return { success: true, recordsSynced: records.length, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    await log("error", `Sync failed: ${errorMessage}`);

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
