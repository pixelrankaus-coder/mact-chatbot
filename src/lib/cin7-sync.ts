/**
 * Cin7 Data Sync to Supabase
 * TASK MACT #032
 *
 * Note: The new tables (cin7_orders, cin7_customers, sync_log) are created
 * via migration and not yet in the generated Database types.
 * We use type assertions to handle this until types are regenerated.
 */

import { createServiceClient } from "@/lib/supabase";
import { listAllSales, listAllCustomers, Cin7SaleListItem, Cin7Customer } from "@/lib/cin7";
import { CIN7_STATUS_LABELS } from "@/types/order";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any;

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
 * Sync all Cin7 orders to Supabase
 */
export async function syncCin7Orders(): Promise<SyncResult> {
  const supabase = createServiceClient() as SupabaseAny;
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
    console.log("Starting Cin7 orders sync...");

    // Fetch all orders from Cin7
    const { SaleList: orders, Total } = await listAllSales();
    console.log(`Fetched ${orders.length} orders from Cin7 (total: ${Total})`);

    if (orders.length === 0) {
      throw new Error("No orders returned from Cin7 API");
    }

    // Transform to database format
    const records = orders.map((order: Cin7SaleListItem) => ({
      cin7_id: order.SaleID,
      order_number: order.OrderNumber,
      status: order.Status,
      status_label: CIN7_STATUS_LABELS[order.Status] || order.Status,
      order_date: order.OrderDate,
      customer_name: order.Customer,
      customer_email: "", // Not available in list response
      customer_id: order.CustomerID,
      total: order.SaleInvoicesTotalAmount || order.InvoiceAmount || 0,
      currency: order.BaseCurrency || "AUD",
      tracking_number: order.CombinedTrackingNumbers || null,
      shipping_status: order.CombinedShippingStatus || null,
      invoice_number: order.InvoiceNumber || null,
      line_items: [], // Would need individual sale fetch for line items
      raw_data: order,
      updated_at: new Date().toISOString(),
    }));

    // Batch upsert (500 at a time to avoid payload limits)
    const batchSize = 500;
    let upsertedCount = 0;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const { error } = await supabase
        .from("cin7_orders")
        .upsert(batch, { onConflict: "cin7_id" });

      if (error) {
        console.error(`Batch ${i / batchSize + 1} upsert error:`, error);
        throw error;
      }

      upsertedCount += batch.length;
      console.log(`Upserted ${upsertedCount}/${records.length} orders`);
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

    console.log(`Cin7 orders sync complete: ${records.length} records in ${duration}ms`);

    return { success: true, recordsSynced: records.length, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    console.error("Cin7 orders sync failed:", errorMessage);

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
 * Sync all Cin7 customers to Supabase
 */
export async function syncCin7Customers(): Promise<SyncResult> {
  const supabase = createServiceClient() as SupabaseAny;
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
    console.log("Starting Cin7 customers sync...");

    // Fetch all customers from Cin7
    const { CustomerList: customers, Total } = await listAllCustomers();
    console.log(`Fetched ${customers.length} customers from Cin7 (total: ${Total})`);

    if (customers.length === 0) {
      throw new Error("No customers returned from Cin7 API");
    }

    // Transform to database format
    const records = customers.map((customer: Cin7Customer) => ({
      cin7_id: customer.ID,
      name: customer.Name,
      email: customer.Email || null,
      phone: customer.Phone || null,
      mobile: customer.Mobile || null,
      fax: customer.Fax || null,
      website: customer.Website || null,
      company: customer.Name, // Company name is typically the customer name in B2B
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
    }));

    // Batch upsert
    const batchSize = 500;
    let upsertedCount = 0;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const { error } = await supabase
        .from("cin7_customers")
        .upsert(batch, { onConflict: "cin7_id" });

      if (error) {
        console.error(`Batch ${i / batchSize + 1} upsert error:`, error);
        throw error;
      }

      upsertedCount += batch.length;
      console.log(`Upserted ${upsertedCount}/${records.length} customers`);
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

    console.log(`Cin7 customers sync complete: ${records.length} records in ${duration}ms`);

    return { success: true, recordsSynced: records.length, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    console.error("Cin7 customers sync failed:", errorMessage);

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
export async function getLastSyncStatus(syncType: string): Promise<SyncStatus | null> {
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
