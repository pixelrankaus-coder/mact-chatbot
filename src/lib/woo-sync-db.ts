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

  // WooCommerce API returns date_created in ISO format like "2024-05-15T10:30:00"
  // Validate the date exists - if missing, the database default would kick in (wrong!)
  const orderDate = order.date_created;
  if (!orderDate) {
    console.warn(`[WooSync] Order #${order.number || order.id} missing date_created!`);
  }

  return {
    woo_id: order.id,
    order_number: String(order.number || order.id),
    status: order.status,
    status_label: WOO_STATUS_LABELS[order.status] || order.status,
    order_date: orderDate || null, // Explicitly null if missing, not undefined
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
    line_items: order.line_items?.map((item: { name: string; sku: string; quantity: number; price: string; total: string }) => ({
      name: item.name,
      sku: item.sku || null,
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

    // Debug: Log sample order dates from raw API response
    if (allOrders.length > 0) {
      const sampleOrders = allOrders.slice(0, 3);
      await log("info", "Sample order dates from WooCommerce API:");
      for (const o of sampleOrders) {
        await log("info", `  Order #${o.number || o.id}: date_created = "${o.date_created}"`);
      }
    }

    // Transform orders
    await log("info", "Transforming order data...");
    const records = allOrders.map(transformOrderForDB);

    // Verify dates are being set correctly
    const ordersWithoutDate = records.filter(r => !r.order_date);
    if (ordersWithoutDate.length > 0) {
      await log("warn", `${ordersWithoutDate.length} orders have no order_date!`);
    }

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
 * Extract customer from order (for guest checkout customers)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractCustomerFromOrder(order: any) {
  const email = order.billing?.email;
  if (!email) return null;

  // Use negative order ID as woo_id for guest customers (to avoid conflicts with real customer IDs)
  // This creates a unique identifier based on email hash
  const guestId = -Math.abs(hashEmail(email));

  return {
    woo_id: guestId,
    email: email,
    first_name: order.billing?.first_name || null,
    last_name: order.billing?.last_name || null,
    username: null, // Guest customers don't have usernames
    phone: order.billing?.phone || null,
    company: order.billing?.company || null,
    billing_address: order.billing,
    shipping_address: order.shipping,
    orders_count: 1, // Will be updated with actual count
    total_spent: parseFloat(order.total) || 0,
    avatar_url: null,
    date_created: order.date_created,
    raw_data: { source: "guest_checkout", order_id: order.id },
    updated_at: new Date().toISOString(),
  };
}

/**
 * Simple email hash for generating consistent guest customer IDs
 */
function hashEmail(email: string): number {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    const char = email.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Sync WooCommerce customers with logging callbacks
 * Includes both registered customers AND guest checkout customers from orders
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
    // STEP 1: Fetch registered customers from WooCommerce API
    await log("info", "Fetching registered customers from WooCommerce...");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allCustomers: any[] = [];
    let page = 1;
    const perPage = 100;
    let hasMore = true;

    while (hasMore) {
      await log("info", `Fetching customers page ${page}...`);

      const response = await api.get("customers", {
        page,
        per_page: perPage,
        orderby: "registered_date",
        order: "desc",
      });

      const customers = response.data || [];
      const total = parseInt(response.headers?.["x-wp-total"] || "0", 10);

      await log("info", `Page ${page}: ${customers.length} registered customers (total: ${total})`);

      allCustomers.push(...customers);

      hasMore = customers.length === perPage && allCustomers.length < total;
      page++;

      // Safety limit
      if (page > 100) {
        await log("warn", "Reached page limit (100 pages)");
        break;
      }
    }

    await log("success", `Fetched ${allCustomers.length} registered customers`);

    // STEP 2: Fetch orders to extract guest checkout customers
    await log("info", "Fetching orders to extract guest customers...");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allOrders: any[] = [];
    page = 1;
    hasMore = true;

    while (hasMore) {
      const response = await api.get("orders", {
        page,
        per_page: perPage,
        orderby: "date",
        order: "desc",
      });

      const orders = response.data || [];
      const total = parseInt(response.headers?.["x-wp-total"] || "0", 10);

      allOrders.push(...orders);

      hasMore = orders.length === perPage && allOrders.length < total;
      page++;

      // Safety limit
      if (page > 100) break;
    }

    await log("info", `Processing ${allOrders.length} orders for guest customers...`);

    // Extract unique guest customers from orders (by email)
    const guestCustomerMap = new Map<string, ReturnType<typeof extractCustomerFromOrder>>();
    const registeredEmails = new Set(allCustomers.map((c) => c.email?.toLowerCase()).filter(Boolean));

    for (const order of allOrders) {
      const email = order.billing?.email?.toLowerCase();
      if (!email) continue;

      // Skip if this is a registered customer
      if (registeredEmails.has(email)) continue;

      // Skip if customer_id > 0 (registered customer)
      if (order.customer_id && order.customer_id > 0) continue;

      const existingGuest = guestCustomerMap.get(email);
      const guestCustomer = extractCustomerFromOrder(order);

      if (!guestCustomer) continue;

      if (existingGuest) {
        // Update aggregated data
        existingGuest.orders_count = (existingGuest.orders_count || 0) + 1;
        existingGuest.total_spent = (existingGuest.total_spent || 0) + (parseFloat(order.total) || 0);
      } else {
        guestCustomerMap.set(email, guestCustomer);
      }
    }

    const guestCustomers = Array.from(guestCustomerMap.values()).filter(Boolean);
    await log("success", `Found ${guestCustomers.length} guest customers from orders`);

    // STEP 3: Transform and combine all customers
    const registeredRecords = allCustomers.map(transformCustomerForDB);
    const allRecords = [...registeredRecords, ...guestCustomers];

    if (allRecords.length === 0) {
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

    await log("info", `Syncing ${allRecords.length} total customers (${registeredRecords.length} registered + ${guestCustomers.length} guests)...`);

    // Batch upsert
    const batchSize = 500;
    let upsertedCount = 0;

    for (let i = 0; i < allRecords.length; i += batchSize) {
      const batch = allRecords.slice(i, i + batchSize);
      await log("info", `Upserting batch ${Math.floor(i / batchSize) + 1}...`);

      const { error } = await supabase
        .from("woo_customers")
        .upsert(batch, { onConflict: "woo_id" });

      if (error) {
        await log("error", `Batch upsert failed: ${error.message}`);
        throw error;
      }

      upsertedCount += batch.length;
      await log("success", `Upserted ${upsertedCount}/${allRecords.length} customers`);
    }

    const duration = Date.now() - startTime;

    // Log success
    await supabase
      .from("sync_log")
      .update({
        status: "completed",
        records_synced: allRecords.length,
        completed_at: new Date().toISOString(),
        duration_ms: duration,
      })
      .eq("id", logEntry?.id);

    await log("success", `Customers sync complete: ${allRecords.length} records in ${(duration / 1000).toFixed(1)}s`);

    return { success: true, recordsSynced: allRecords.length, duration };
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
