/**
 * Cin7 Data Sync to Supabase
 * TASK MACT #032
 *
 * Note: The new tables (cin7_orders, cin7_customers, sync_log) are created
 * via migration and not yet in the generated Database types.
 * We use type assertions to handle this until types are regenerated.
 */

import { createServiceClient } from "@/lib/supabase";
import { listAllSales, listAllCustomers, getSale, Cin7SaleListItem, Cin7Customer, Cin7Sale } from "@/lib/cin7";
import { CIN7_STATUS_LABELS } from "@/types/order";

// Rate limiting helper - delays between API calls
async function rateLimitedBatch<T, R>(
  items: T[],
  batchSize: number,
  delayMs: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);

    // Delay between batches (except for last batch)
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return results;
}

// Extract invoice payment data from full sale data
function extractInvoiceData(sale: Cin7Sale | null): {
  invoice_total: number | null;
  invoice_paid: number | null;
  invoice_due_date: string | null;
  invoice_status: string | null;
} {
  if (!sale?.Invoices || sale.Invoices.length === 0) {
    return { invoice_total: null, invoice_paid: null, invoice_due_date: null, invoice_status: null };
  }

  // Sum across all invoices for the sale
  let totalAmount = 0;
  let totalPaid = 0;
  let latestDueDate: string | null = null;
  let overallStatus = "PAID";

  for (const inv of sale.Invoices) {
    totalAmount += inv.Total || 0;
    totalPaid += inv.Paid || 0;
    // Track the latest invoice date as due date (Cin7 doesn't expose explicit due date)
    if (inv.InvoiceDate && (!latestDueDate || inv.InvoiceDate > latestDueDate)) {
      latestDueDate = inv.InvoiceDate;
    }
    // If any invoice is not fully paid, mark as unpaid
    if ((inv.Paid || 0) < (inv.Total || 0)) {
      overallStatus = "UNPAID";
    }
  }

  return {
    invoice_total: totalAmount || null,
    invoice_paid: totalPaid,
    invoice_due_date: latestDueDate,
    invoice_status: totalAmount > 0 ? overallStatus : null,
  };
}

// Extract line items from full sale data
function extractLineItems(sale: Cin7Sale | null): Array<{ name: string; sku?: string; quantity: number; price: number }> {
  if (!sale) return [];

  // Try Order.Lines first
  if (sale.Order?.Lines && sale.Order.Lines.length > 0) {
    return sale.Order.Lines.map(line => ({
      name: line.Name || "Unknown Product",
      sku: line.SKU,
      quantity: line.Quantity,
      price: line.Price,
    }));
  }

  // Fallback to Invoices[0].Lines
  if (sale.Invoices?.[0]?.Lines && sale.Invoices[0].Lines.length > 0) {
    return sale.Invoices[0].Lines.map(line => ({
      name: line.Name || "Unknown Product",
      sku: line.SKU,
      quantity: line.Quantity,
      price: line.Price,
    }));
  }

  return [];
}

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

    // Fetch individual sale details for line items (rate limited: 5 at a time, 500ms delay)
    console.log(`Fetching line items for ${orders.length} orders (this may take a while)...`);
    const saleDetails = await rateLimitedBatch(
      orders,
      5, // 5 concurrent requests
      500, // 500ms delay between batches
      async (order) => {
        const sale = await getSale(order.SaleID);
        return { saleId: order.SaleID, sale };
      }
    );

    // Create a map of sale details for quick lookup
    const saleDetailsMap = new Map<string, Cin7Sale | null>();
    for (const { saleId, sale } of saleDetails) {
      saleDetailsMap.set(saleId, sale);
    }

    console.log(`Fetched details for ${saleDetails.filter(d => d.sale).length} orders`);

    // Fetch customer payment terms for cross-referencing
    const { data: customerTerms } = await supabase
      .from("cin7_customers")
      .select("cin7_id, payment_term")
      .not("payment_term", "is", null);
    const paymentTermMap = new Map<string, string>();
    if (customerTerms) {
      for (const c of customerTerms) paymentTermMap.set(c.cin7_id, c.payment_term);
    }

    // Transform to database format
    const records = orders.map((order: Cin7SaleListItem) => {
      const saleDetail = saleDetailsMap.get(order.SaleID);
      const lineItems = extractLineItems(saleDetail);
      const invoiceData = extractInvoiceData(saleDetail);

      return {
        cin7_id: order.SaleID,
        order_number: order.OrderNumber,
        status: order.Status,
        status_label: CIN7_STATUS_LABELS[order.Status] || order.Status,
        order_date: order.OrderDate,
        customer_name: order.Customer,
        customer_email: saleDetail?.Email || "", // Now available from sale details
        customer_id: order.CustomerID,
        total: order.SaleInvoicesTotalAmount || order.InvoiceAmount || 0,
        currency: order.BaseCurrency || "AUD",
        tracking_number: order.CombinedTrackingNumbers || null,
        shipping_status: order.CombinedShippingStatus || null,
        invoice_number: order.InvoiceNumber || null,
        line_items: lineItems, // Now populated with actual product data
        invoice_total: invoiceData.invoice_total,
        invoice_paid: invoiceData.invoice_paid,
        invoice_due_date: invoiceData.invoice_due_date,
        invoice_status: invoiceData.invoice_status,
        payment_term: paymentTermMap.get(order.CustomerID) || null,
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
    const records = customers.map((customer: Cin7Customer) => {
      // Get email from root level, or from first contact with email, or from default contact
      let email = customer.Email || null;
      if (!email && customer.Contacts && customer.Contacts.length > 0) {
        // Try default contact first
        const defaultContact = customer.Contacts.find((c) => c.Default);
        if (defaultContact?.Email) {
          email = defaultContact.Email;
        } else {
          // Otherwise use first contact with an email
          const contactWithEmail = customer.Contacts.find((c) => c.Email);
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
      };
    });

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
