import { createClient } from "@supabase/supabase-js";
import { getSale } from "@/lib/cin7";

// Server-side Supabase client
function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

export type SegmentType = "dormant" | "vip" | "active" | "all" | "custom";

export interface SegmentInfo {
  id: SegmentType;
  name: string;
  description: string;
  count?: number;
}

export const SEGMENTS: SegmentInfo[] = [
  {
    id: "dormant",
    name: "Dormant Customers",
    description: "No order in 12+ months",
  },
  {
    id: "vip",
    name: "VIP Customers",
    description: "Spent $5,000+ or 5+ orders",
  },
  {
    id: "active",
    name: "Active Customers",
    description: "Ordered within last 12 months",
  },
  {
    id: "all",
    name: "All Customers",
    description: "Everyone with an email address",
  },
  {
    id: "custom",
    name: "Custom / Test",
    description: "Enter email addresses manually",
  },
];

export interface CustomerRecipient {
  id: string;
  email: string;
  name: string;
  company?: string;
  total_spent?: number;
  order_count?: number;
  last_order_date?: string;
  last_product?: string;
}

export async function getSegmentRecipients(
  segment: SegmentType,
  segmentFilter?: Record<string, unknown>
): Promise<CustomerRecipient[]> {
  // Handle custom/test segment with manually entered emails
  // Look up actual customer data from both Cin7 and WooCommerce
  if (segment === "custom" && segmentFilter?.emails) {
    const emails = (segmentFilter.emails as string[]).map((e) =>
      e.toLowerCase().trim()
    );
    const supabase = getSupabase();

    // Look up customers in both systems
    const recipients: CustomerRecipient[] = [];

    for (const email of emails) {
      // Try to find in Cin7 first
      const { data: cin7Customer } = await supabase
        .from("cin7_customers")
        .select("id, cin7_id, email, name, company")
        .ilike("email", email)
        .single();

      // Try to find in WooCommerce
      const { data: wooCustomer } = await supabase
        .from("woo_customers")
        .select("id, woo_id, email, first_name, last_name, company")
        .ilike("email", email)
        .single();

      // Get order data from both systems
      let totalSpent = 0;
      let orderCount = 0;
      let lastOrderDate: string | null = null;
      let lastProduct: string | null = null;

      // Check Cin7 orders
      if (cin7Customer?.cin7_id) {
        const { data: cin7Orders } = await supabase
          .from("cin7_orders")
          .select("cin7_id, order_date, total, line_items")
          .eq("customer_id", cin7Customer.cin7_id)
          .order("order_date", { ascending: false });

        if (cin7Orders && cin7Orders.length > 0) {
          cin7Orders.forEach((order) => {
            totalSpent += parseFloat(String(order.total)) || 0;
            orderCount++;
          });
          lastOrderDate = cin7Orders[0].order_date;

          // Check if line_items has data
          const lineItems = cin7Orders[0].line_items as Array<{
            name?: string;
          }> | null;
          if (lineItems && lineItems.length > 0 && lineItems[0].name) {
            lastProduct = lineItems[0].name;
          } else {
            // Cin7 sync doesn't include line items - fetch from API
            const saleId = cin7Orders[0].cin7_id;
            if (saleId) {
              console.log(`[Segments] Fetching Cin7 sale ${saleId} for product details...`);
              const saleDetails = await getSale(saleId);
              if (saleDetails?.Order?.Lines && saleDetails.Order.Lines.length > 0) {
                lastProduct = saleDetails.Order.Lines[0].Name || null;
                console.log(`[Segments] Found Cin7 product: ${lastProduct}`);
              } else if (saleDetails?.Invoices && saleDetails.Invoices.length > 0) {
                // Try invoice lines as fallback
                const invoiceLines = saleDetails.Invoices[0].Lines;
                if (invoiceLines && invoiceLines.length > 0) {
                  lastProduct = invoiceLines[0].Name || null;
                  console.log(`[Segments] Found Cin7 product from invoice: ${lastProduct}`);
                }
              }
            }
          }
        }
      }

      // Check WooCommerce orders by customer_id first (if customer exists)
      let foundWooOrdersByCustomerId = false;
      if (wooCustomer?.woo_id) {
        const { data: wooOrders } = await supabase
          .from("woo_orders")
          .select("order_date, total, line_items")
          .eq("customer_id", wooCustomer.woo_id)
          .order("order_date", { ascending: false });

        if (wooOrders && wooOrders.length > 0) {
          foundWooOrdersByCustomerId = true;
          wooOrders.forEach((order) => {
            totalSpent += parseFloat(String(order.total)) || 0;
            orderCount++;
          });
          // Use WooCommerce date if more recent than Cin7
          const wooDate = wooOrders[0].order_date?.split("T")[0];
          if (!lastOrderDate || (wooDate && wooDate > lastOrderDate)) {
            lastOrderDate = wooDate || null;
            const lineItems = wooOrders[0].line_items as Array<{
              name?: string;
            }> | null;
            if (lineItems && lineItems.length > 0 && lineItems[0].name) {
              lastProduct = lineItems[0].name;
            }
          }
        }
      }

      // ALWAYS check WooCommerce orders by email if no orders found by customer_id
      // This catches guest checkouts and mismatched customer_ids
      if (!foundWooOrdersByCustomerId) {
        const { data: wooOrdersByEmail } = await supabase
          .from("woo_orders")
          .select("order_date, total, line_items")
          .ilike("customer_email", email)
          .order("order_date", { ascending: false });

        if (wooOrdersByEmail && wooOrdersByEmail.length > 0) {
          console.log(
            `[Segments] Found ${wooOrdersByEmail.length} WooCommerce orders by email for ${email}`
          );
          wooOrdersByEmail.forEach((order) => {
            totalSpent += parseFloat(String(order.total)) || 0;
            orderCount++;
          });
          const wooDate = wooOrdersByEmail[0].order_date?.split("T")[0];
          if (!lastOrderDate || (wooDate && wooDate > lastOrderDate)) {
            lastOrderDate = wooDate || null;
            const lineItems = wooOrdersByEmail[0].line_items as Array<{
              name?: string;
            }> | null;
            if (lineItems && lineItems.length > 0 && lineItems[0].name) {
              lastProduct = lineItems[0].name;
            }
          }
        }
      }

      // Build recipient with best available data
      const customerName =
        cin7Customer?.name ||
        (wooCustomer
          ? `${wooCustomer.first_name || ""} ${wooCustomer.last_name || ""}`.trim()
          : null) ||
        email.split("@")[0].charAt(0).toUpperCase() +
          email.split("@")[0].slice(1);

      const customerCompany =
        cin7Customer?.company || wooCustomer?.company || undefined;

      recipients.push({
        id: cin7Customer?.id || wooCustomer?.id || `custom-${email}`,
        email,
        name: customerName,
        company: customerCompany,
        total_spent: totalSpent,
        order_count: orderCount,
        last_order_date: lastOrderDate || undefined,
        last_product: lastProduct || undefined,
      });

      console.log(
        `[Segments] Custom email ${email}: found ${orderCount} orders, last_product: ${lastProduct}, last_order_date: ${lastOrderDate}`
      );
    }

    return recipients;
  }

  const supabase = getSupabase();

  // Get all Cin7 customers with email
  const { data: cin7Customers, error: customerError } = await supabase
    .from("cin7_customers")
    .select("id, cin7_id, email, name, company")
    .not("email", "is", null)
    .neq("email", "");

  if (customerError) {
    console.error("Error fetching cin7_customers:", customerError);
    return [];
  }

  if (!cin7Customers || cin7Customers.length === 0) {
    console.log("[Segments] No customers found with email addresses");
    return [];
  }

  // Get all Cin7 orders to compute aggregates
  const { data: cin7Orders, error: orderError } = await supabase
    .from("cin7_orders")
    .select("customer_id, order_date, total, line_items");

  if (orderError) {
    console.error("Error fetching cin7_orders:", orderError);
    return [];
  }

  // Build order stats per customer (keyed by cin7_id)
  const orderStats: Record<
    string,
    {
      total_spent: number;
      order_count: number;
      last_order_date: string | null;
      last_product: string | null;
    }
  > = {};

  (cin7Orders || []).forEach((order) => {
    const cid = order.customer_id;
    if (!cid) return;

    if (!orderStats[cid]) {
      orderStats[cid] = {
        total_spent: 0,
        order_count: 0,
        last_order_date: null,
        last_product: null,
      };
    }

    orderStats[cid].order_count++;
    orderStats[cid].total_spent += parseFloat(String(order.total)) || 0;

    // Track most recent order date and product
    if (
      !orderStats[cid].last_order_date ||
      order.order_date > orderStats[cid].last_order_date
    ) {
      orderStats[cid].last_order_date = order.order_date;
      // Get first line item name from most recent order
      const lineItems = order.line_items as Array<{ name?: string }> | null;
      if (lineItems && lineItems.length > 0 && lineItems[0].name) {
        orderStats[cid].last_product = lineItems[0].name;
      }
    }
  });

  // Combine customers with their order stats
  const today = new Date();
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(today.getFullYear() - 1);
  const oneYearAgoStr = oneYearAgo.toISOString().split("T")[0];

  const recipients: CustomerRecipient[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cin7Customers.forEach((customer: any) => {
    const stats = orderStats[customer.cin7_id] || {
      total_spent: 0,
      order_count: 0,
      last_order_date: null,
      last_product: null,
    };

    // Apply segment filters
    switch (segment) {
      case "dormant":
        // No order in 12+ months (but has ordered before)
        if (stats.order_count === 0) return;
        if (!stats.last_order_date || stats.last_order_date >= oneYearAgoStr)
          return;
        break;
      case "vip":
        // Spent $5000+ OR 5+ orders
        if (stats.total_spent < 5000 && stats.order_count < 5) return;
        break;
      case "active":
        // Ordered within last 12 months
        if (!stats.last_order_date || stats.last_order_date < oneYearAgoStr)
          return;
        break;
      case "all":
      default:
        // No additional filter
        break;
    }

    recipients.push({
      id: customer.id,
      email: customer.email.toLowerCase(),
      name: customer.name || "",
      company: customer.company || undefined,
      total_spent: stats.total_spent,
      order_count: stats.order_count,
      last_order_date: stats.last_order_date || undefined,
      last_product: stats.last_product || undefined,
    });
  });

  console.log(`[Segments] Found ${recipients.length} recipients for segment "${segment}"`);
  return recipients;
}

export async function getSegmentCount(
  segment: SegmentType,
  segmentFilter?: Record<string, unknown>
): Promise<number> {
  const recipients = await getSegmentRecipients(segment, segmentFilter);
  return recipients.length;
}

export async function getSegmentsWithCounts(): Promise<SegmentInfo[]> {
  const segmentsWithCounts = await Promise.all(
    SEGMENTS.map(async (segment) => {
      const count = await getSegmentCount(segment.id);
      return { ...segment, count };
    })
  );
  return segmentsWithCounts;
}

export interface PersonalizationData {
  first_name: string;
  last_name: string;
  company: string;
  last_product: string;
  last_order_date: string;
  days_since_order: number | null;
  total_spent: number;
  order_count: number;
}

export function buildPersonalizationData(
  customer: CustomerRecipient
): PersonalizationData {
  const lastOrderDate = customer.last_order_date
    ? new Date(customer.last_order_date)
    : null;
  const daysSinceOrder = lastOrderDate
    ? Math.floor((Date.now() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const nameParts = (customer.name || "").split(" ");

  return {
    first_name: nameParts[0] || "",
    last_name: nameParts.slice(1).join(" ") || "",
    company: customer.company || "",
    last_product: customer.last_product || "",
    last_order_date: customer.last_order_date || "",
    days_since_order: daysSinceOrder,
    total_spent: customer.total_spent || 0,
    order_count: customer.order_count || 0,
  };
}
