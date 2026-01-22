/**
 * Cin7 Data Sync with DB Credentials + Logging
 * TASK MACT #036, #039
 *
 * Enhanced version that:
 * 1. Uses credentials from integration_settings table (not env vars)
 * 2. Provides logging callbacks for real-time progress
 * 3. Supports full and incremental sync modes (TASK #039)
 * 4. No artificial page limits - fetches all data
 */

import { createServiceClient } from "@/lib/supabase";
import { CIN7_STATUS_LABELS } from "@/types/order";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any;

export interface SyncResult {
  success: boolean;
  recordsSynced: number;
  duration: number;
  error?: string;
}

export type SyncMode = "full" | "incremental";

type LogCallback = (
  level: "info" | "warn" | "error" | "success",
  message: string,
  details?: Record<string, unknown>
) => Promise<void>;

interface Cin7Settings {
  account_id: string;
  api_key: string;
  sync_frequency?: string;
  last_sync_at?: string;
}

const CIN7_BASE_URL = "https://inventory.dearsystems.com/ExternalApi/v2";

/**
 * Get Cin7 credentials from database
 */
async function getCin7Credentials(supabase: SupabaseAny): Promise<Cin7Settings | null> {
  const { data, error } = await supabase
    .from("integration_settings")
    .select("settings, is_enabled")
    .eq("integration_type", "cin7")
    .single();

  if (error || !data) {
    // Fall back to environment variables if no DB config
    const envAccountId = process.env.CIN7_ACCOUNT_ID;
    const envApiKey = process.env.CIN7_API_KEY;

    if (envAccountId && envApiKey) {
      return {
        account_id: envAccountId,
        api_key: envApiKey,
      };
    }
    return null;
  }

  // If integration is disabled, check env vars as fallback
  if (!data.is_enabled) {
    const envAccountId = process.env.CIN7_ACCOUNT_ID;
    const envApiKey = process.env.CIN7_API_KEY;

    if (envAccountId && envApiKey) {
      return {
        account_id: envAccountId,
        api_key: envApiKey,
      };
    }
    return null;
  }

  return data.settings as Cin7Settings;
}

/**
 * Build headers for Cin7 API calls
 */
function buildHeaders(credentials: Cin7Settings): HeadersInit {
  return {
    "Content-Type": "application/json",
    "api-auth-accountid": credentials.account_id,
    "api-auth-applicationkey": credentials.api_key,
  };
}

/**
 * Fetch sales list from Cin7 with pagination and optional date filter
 */
async function fetchSalesList(
  credentials: Cin7Settings,
  page: number,
  limit: number,
  modifiedSince?: string
): Promise<{ SaleList: any[]; Total: number }> {
  const query = new URLSearchParams();
  query.set("Page", String(page));
  query.set("Limit", String(limit));

  // Add modified since filter for incremental sync
  if (modifiedSince) {
    query.set("ModifiedSince", modifiedSince);
  }

  const res = await fetch(`${CIN7_BASE_URL}/saleList?${query}`, {
    headers: buildHeaders(credentials),
  });

  if (!res.ok) {
    throw new Error(`Cin7 API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();

  // Cin7 API can return 200 OK with errors in the response body
  if (data.Errors && data.Errors.length > 0) {
    throw new Error(`Cin7 API error: ${data.Errors.join(", ")}`);
  }

  return data;
}

/**
 * Fetch customers from Cin7 with pagination
 */
async function fetchCustomers(
  credentials: Cin7Settings,
  page: number,
  limit: number
): Promise<{ CustomerList: any[]; Total: number }> {
  const query = new URLSearchParams();
  query.set("Page", String(page));
  query.set("Limit", String(limit));

  const res = await fetch(`${CIN7_BASE_URL}/customer?${query}`, {
    headers: buildHeaders(credentials),
  });

  if (!res.ok) {
    throw new Error(`Cin7 API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();

  // Cin7 API can return 200 OK with errors in the response body
  if (data.Errors && data.Errors.length > 0) {
    throw new Error(`Cin7 API error: ${data.Errors.join(", ")}`);
  }

  return data;
}

/**
 * Sync Cin7 orders with logging callback
 * @param mode - 'full' fetches all orders, 'incremental' fetches last 30 days only
 */
export async function syncCin7OrdersWithLogging(
  supabase: SupabaseAny,
  log: LogCallback,
  mode: SyncMode = "full"
): Promise<SyncResult> {
  const startTime = Date.now();

  // Log sync start
  const { data: logEntry } = await supabase
    .from("sync_log")
    .insert({
      sync_type: "cin7_orders",
      status: "started",
    })
    .select()
    .single();

  try {
    // Get credentials
    const credentials = await getCin7Credentials(supabase);
    if (!credentials) {
      await log("error", "Cin7 credentials not configured");
      throw new Error("Cin7 credentials not configured. Please configure in Settings > Integrations.");
    }

    // Calculate date filter for incremental sync
    let modifiedSince: string | undefined;
    if (mode === "incremental") {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      modifiedSince = thirtyDaysAgo.toISOString().split("T")[0];
      await log("info", `Incremental sync: Fetching orders modified since ${modifiedSince}...`);
    } else {
      await log("info", "Full sync: Fetching ALL orders from Cin7 API...");
    }

    // First request to get total count
    const limit = 250;
    const firstResult = await fetchSalesList(credentials, 1, limit, modifiedSince);
    const total = firstResult.Total;
    const allOrders: any[] = [...(firstResult.SaleList || [])];

    await log("info", `Page 1: ${firstResult.SaleList?.length || 0} orders (total: ${total})`);

    // Calculate remaining pages - NO LIMIT for full sync
    const totalPages = Math.ceil(total / limit);

    if (totalPages > 50) {
      await log("info", `Large dataset: ${totalPages} pages to fetch (no page limit)`);
    }

    // Fetch remaining pages
    for (let page = 2; page <= totalPages; page++) {
      const result = await fetchSalesList(credentials, page, limit, modifiedSince);
      allOrders.push(...(result.SaleList || []));

      // Log every 10 pages to avoid spam
      if (page % 10 === 0 || page === totalPages) {
        await log("info", `Page ${page}/${totalPages}: ${allOrders.length} orders fetched so far`);
      }

      // Small delay to respect rate limits
      if (page < totalPages) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    await log("info", `Fetched ${allOrders.length} orders total`);

    if (allOrders.length === 0) {
      await log("warn", "No orders returned from Cin7 API");
      throw new Error("No orders returned from Cin7 API");
    }

    // Transform to database format
    await log("info", "Transforming order data...");
    const records = allOrders.map((order: any) => ({
      cin7_id: order.SaleID,
      order_number: order.OrderNumber,
      status: order.Status,
      status_label: CIN7_STATUS_LABELS[order.Status] || order.Status,
      order_date: order.OrderDate,
      customer_name: order.Customer,
      customer_email: "",
      customer_id: order.CustomerID,
      total: order.SaleInvoicesTotalAmount || order.InvoiceAmount || 0,
      currency: order.BaseCurrency || "AUD",
      tracking_number: order.CombinedTrackingNumbers || null,
      shipping_status: order.CombinedShippingStatus || null,
      invoice_number: order.InvoiceNumber || null,
      line_items: [],
      raw_data: order,
      updated_at: new Date().toISOString(),
    }));

    // Batch upsert
    const batchSize = 500;
    let upsertedCount = 0;

    await log("info", `Upserting ${records.length} orders in batches of ${batchSize}...`);

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const { error } = await supabase
        .from("cin7_orders")
        .upsert(batch, { onConflict: "cin7_id" });

      if (error) {
        await log("error", `Batch upsert error: ${error.message}`);
        throw error;
      }

      upsertedCount += batch.length;
      await log("info", `Upserted ${upsertedCount}/${records.length} orders`);
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

    await log("success", `Cin7 orders sync complete: ${records.length} records in ${(duration / 1000).toFixed(1)}s`);

    return { success: true, recordsSynced: records.length, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    await log("error", `Cin7 orders sync failed: ${errorMessage}`);

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
 * Sync Cin7 customers with logging callback
 * Customers always do full sync (no incremental mode)
 */
export async function syncCin7CustomersWithLogging(
  supabase: SupabaseAny,
  log: LogCallback
): Promise<SyncResult> {
  const startTime = Date.now();

  // Log sync start
  const { data: logEntry } = await supabase
    .from("sync_log")
    .insert({
      sync_type: "cin7_customers",
      status: "started",
    })
    .select()
    .single();

  try {
    // Get credentials
    const credentials = await getCin7Credentials(supabase);
    if (!credentials) {
      await log("error", "Cin7 credentials not configured");
      throw new Error("Cin7 credentials not configured. Please configure in Settings > Integrations.");
    }

    await log("info", "Fetching ALL customers from Cin7 API...");

    // First request to get total count
    const limit = 250;
    const firstResult = await fetchCustomers(credentials, 1, limit);
    const total = firstResult.Total;
    const allCustomers: any[] = [...(firstResult.CustomerList || [])];

    await log("info", `Page 1: ${firstResult.CustomerList?.length || 0} customers (total: ${total})`);

    // Calculate remaining pages - NO LIMIT
    const totalPages = Math.ceil(total / limit);

    if (totalPages > 20) {
      await log("info", `Large dataset: ${totalPages} pages to fetch (no page limit)`);
    }

    // Fetch remaining pages
    for (let page = 2; page <= totalPages; page++) {
      const result = await fetchCustomers(credentials, page, limit);
      allCustomers.push(...(result.CustomerList || []));

      // Log every 5 pages to avoid spam
      if (page % 5 === 0 || page === totalPages) {
        await log("info", `Page ${page}/${totalPages}: ${allCustomers.length} customers fetched so far`);
      }

      // Small delay to respect rate limits
      if (page < totalPages) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    await log("info", `Fetched ${allCustomers.length} customers total`);

    if (allCustomers.length === 0) {
      await log("warn", "No customers returned from Cin7 API");
      throw new Error("No customers returned from Cin7 API");
    }

    // Transform to database format
    await log("info", "Transforming customer data...");
    const records = allCustomers.map((customer: any) => {
      // Get email from root level, or from first contact with email, or from default contact
      let email = customer.Email || null;
      if (!email && customer.Contacts && customer.Contacts.length > 0) {
        // Try default contact first
        const defaultContact = customer.Contacts.find((c: any) => c.Default);
        if (defaultContact?.Email) {
          email = defaultContact.Email;
        } else {
          // Otherwise use first contact with an email
          const contactWithEmail = customer.Contacts.find((c: any) => c.Email);
          if (contactWithEmail?.Email) {
            email = contactWithEmail.Email;
          }
        }
      }

      return {
        cin7_id: customer.ID,
        name: customer.Name,
        email: email,
          phone: customer.Phone || null,
        mobile: customer.Mobile || null,
        fax: customer.Fax || null,
        website: customer.Website || null,
        company: customer.Name,
        status: customer.Status,
        currency: customer.Currency || "AUD",
        payment_term: customer.PaymentTerm || null,
        credit_limit: customer.CreditLimit || null,
        discount: customer.Discount || null,
        tax_number: customer.TaxNumber || null,
        tags: customer.Tags || null,
        addresses: customer.Addresses || [],
        contacts: customer.Contacts || [],
        raw_data: customer,
        updated_at: new Date().toISOString(),
      };
    });

    // Batch upsert
    const batchSize = 500;
    let upsertedCount = 0;

    await log("info", `Upserting ${records.length} customers in batches of ${batchSize}...`);

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const { error } = await supabase
        .from("cin7_customers")
        .upsert(batch, { onConflict: "cin7_id" });

      if (error) {
        await log("error", `Batch upsert error: ${error.message}`);
        throw error;
      }

      upsertedCount += batch.length;
      await log("info", `Upserted ${upsertedCount}/${records.length} customers`);
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

    await log("success", `Cin7 customers sync complete: ${records.length} records in ${(duration / 1000).toFixed(1)}s`);

    return { success: true, recordsSynced: records.length, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    await log("error", `Cin7 customers sync failed: ${errorMessage}`);

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
 * Get order count from Supabase cache
 */
export async function getCin7OrderCount(): Promise<number> {
  const supabase = createServiceClient() as SupabaseAny;

  const { count } = await supabase
    .from("cin7_orders")
    .select("*", { count: "exact", head: true });

  return count || 0;
}

/**
 * Get customer count from Supabase cache
 */
export async function getCin7CustomerCount(): Promise<number> {
  const supabase = createServiceClient() as SupabaseAny;

  const { count } = await supabase
    .from("cin7_customers")
    .select("*", { count: "exact", head: true });

  return count || 0;
}

/**
 * Update Cin7 sync settings (last sync time, counts)
 */
export async function updateCin7SyncSettings(
  supabase: SupabaseAny,
  updates: {
    last_sync_at?: string;
    orders_cached?: number;
    customers_cached?: number;
  }
): Promise<void> {
  // Get existing settings
  const { data: existing } = await supabase
    .from("integration_settings")
    .select("settings")
    .eq("integration_type", "cin7")
    .single();

  if (existing?.settings) {
    const newSettings = {
      ...existing.settings,
      ...updates,
    };

    await supabase
      .from("integration_settings")
      .update({ settings: newSettings })
      .eq("integration_type", "cin7");
  }
}

/**
 * Get Cin7 sync frequency setting
 */
export async function getCin7SyncFrequency(supabase: SupabaseAny): Promise<string> {
  const { data } = await supabase
    .from("integration_settings")
    .select("settings")
    .eq("integration_type", "cin7")
    .single();

  return data?.settings?.sync_frequency || "1hour";
}

/**
 * Get last sync timestamp
 */
export async function getLastSyncTime(supabase: SupabaseAny): Promise<string | null> {
  const { data } = await supabase
    .from("integration_settings")
    .select("settings")
    .eq("integration_type", "cin7")
    .single();

  return data?.settings?.last_sync_at || null;
}
