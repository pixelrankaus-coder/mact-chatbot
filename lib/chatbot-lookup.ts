/**
 * Chatbot Order/Customer Lookup Library
 * TASK MACT #033: Uses Supabase cache instead of Cin7 API
 * TASK MACT #034: Added WooCommerce cache support
 *
 * Provides fast, cached lookups for chatbot order inquiries
 * Queries both Cin7 and WooCommerce caches for comprehensive results
 */

import { createServiceClient } from "@/lib/supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any;

export interface OrderLookupResult {
  found: boolean;
  order?: {
    orderNumber: string;
    status: string;
    statusLabel: string;
    orderDate: string;
    total: number;
    currency: string;
    customerName: string;
    customerEmail: string;
    trackingNumber: string | null;
    shippingStatus: string | null;
    invoiceNumber: string | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    lineItems: any[];
    source: "cin7" | "woocommerce";
  };
  error?: string;
}

export interface CustomerLookupResult {
  found: boolean;
  customer?: {
    name: string;
    email: string;
    phone: string;
    company: string;
  };
  orders?: Array<{
    orderNumber: string;
    status: string;
    statusLabel: string;
    orderDate: string;
    total: number;
    trackingNumber: string | null;
    source: "cin7" | "woocommerce";
  }>;
  summary?: {
    totalOrders: number;
    totalSpent: number;
    lastOrderDate: string | null;
  };
  error?: string;
}

/**
 * Look up order by order number from Supabase cache
 * Searches both Cin7 and WooCommerce caches
 */
export async function lookupOrderByNumber(
  orderNumber: string
): Promise<OrderLookupResult> {
  const supabase = createServiceClient() as SupabaseAny;

  // Normalize order number - handle with/without SO- prefix for Cin7
  const normalized = orderNumber.toUpperCase().replace(/^SO-?/i, "");
  const withPrefix = `SO-${normalized}`;
  const withoutPrefix = normalized;

  // Search both Cin7 and WooCommerce in parallel
  const [cin7Result, wooResult] = await Promise.all([
    // Search cin7_orders with multiple patterns
    supabase
      .from("cin7_orders")
      .select("*")
      .or(
        `order_number.ilike.${withPrefix},order_number.ilike.SO${withoutPrefix},order_number.ilike.${orderNumber}`
      )
      .limit(1)
      .single(),
    // Search woo_orders by order number
    supabase
      .from("woo_orders")
      .select("*")
      .or(
        `order_number.ilike.${orderNumber},order_number.ilike.${withoutPrefix}`
      )
      .limit(1)
      .single(),
  ]);

  // Check Cin7 first (primary source for B2B)
  if (cin7Result.data) {
    const cin7Order = cin7Result.data;
    return {
      found: true,
      order: {
        orderNumber: cin7Order.order_number || "",
        status: cin7Order.status || "",
        statusLabel: cin7Order.status_label || cin7Order.status || "",
        orderDate: cin7Order.order_date || "",
        total: parseFloat(cin7Order.total) || 0,
        currency: cin7Order.currency || "AUD",
        customerName: cin7Order.customer_name || "",
        customerEmail: cin7Order.customer_email || "",
        trackingNumber: cin7Order.tracking_number || null,
        shippingStatus: cin7Order.shipping_status || null,
        invoiceNumber: cin7Order.invoice_number || null,
        lineItems: cin7Order.line_items || [],
        source: "cin7",
      },
    };
  }

  // Check WooCommerce if not found in Cin7
  if (wooResult.data) {
    const wooOrder = wooResult.data;
    return {
      found: true,
      order: {
        orderNumber: wooOrder.order_number || String(wooOrder.woo_id),
        status: wooOrder.status || "",
        statusLabel: wooOrder.status_label || wooOrder.status || "",
        orderDate: wooOrder.order_date || "",
        total: parseFloat(wooOrder.total) || 0,
        currency: wooOrder.currency || "AUD",
        customerName: wooOrder.customer_name || "",
        customerEmail: wooOrder.customer_email || "",
        trackingNumber: wooOrder.tracking_number || null,
        shippingStatus: null, // WooCommerce doesn't have shipping_status field
        invoiceNumber: null, // WooCommerce doesn't have invoice_number field
        lineItems: wooOrder.line_items || [],
        source: "woocommerce",
      },
    };
  }

  // Log errors if any (but not "no rows" errors)
  if (cin7Result.error && cin7Result.error.code !== "PGRST116") {
    console.error("Cin7 order lookup error:", cin7Result.error);
  }
  if (wooResult.error && wooResult.error.code !== "PGRST116") {
    console.error("WooCommerce order lookup error:", wooResult.error);
  }

  return { found: false, error: "Order not found" };
}

/**
 * Look up customer and their order history by email from Supabase cache
 * Searches both Cin7 and WooCommerce caches
 */
export async function lookupCustomerByEmail(
  email: string
): Promise<CustomerLookupResult> {
  const supabase = createServiceClient() as SupabaseAny;
  const normalizedEmail = email.toLowerCase().trim();

  // Get customer from both caches in parallel
  const [cin7CustomerResult, wooCustomerResult, cin7OrdersResult, wooOrdersResult] = await Promise.all([
    // Cin7 customer
    supabase
      .from("cin7_customers")
      .select("*")
      .ilike("email", normalizedEmail)
      .limit(1)
      .single(),
    // WooCommerce customer
    supabase
      .from("woo_customers")
      .select("*")
      .ilike("email", normalizedEmail)
      .limit(1)
      .single(),
    // Cin7 orders
    supabase
      .from("cin7_orders")
      .select("order_number, status, status_label, order_date, total, tracking_number")
      .ilike("customer_email", normalizedEmail)
      .order("order_date", { ascending: false })
      .limit(10),
    // WooCommerce orders
    supabase
      .from("woo_orders")
      .select("order_number, woo_id, status, status_label, order_date, total, tracking_number")
      .ilike("customer_email", normalizedEmail)
      .order("order_date", { ascending: false })
      .limit(10),
  ]);

  const cin7Customer = cin7CustomerResult.data;
  const wooCustomer = wooCustomerResult.data;
  const cin7Orders = cin7OrdersResult.data || [];
  const wooOrders = wooOrdersResult.data || [];

  // Merge and format orders from both sources
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cin7OrderList = cin7Orders.map((o: any) => ({
    orderNumber: o.order_number || "",
    status: o.status || "",
    statusLabel: o.status_label || o.status || "",
    orderDate: o.order_date || "",
    total: parseFloat(o.total) || 0,
    trackingNumber: o.tracking_number || null,
    source: "cin7" as const,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wooOrderList = wooOrders.map((o: any) => ({
    orderNumber: o.order_number || String(o.woo_id),
    status: o.status || "",
    statusLabel: o.status_label || o.status || "",
    orderDate: o.order_date || "",
    total: parseFloat(o.total) || 0,
    trackingNumber: o.tracking_number || null,
    source: "woocommerce" as const,
  }));

  // Combine and sort by date (newest first)
  const allOrders = [...cin7OrderList, ...wooOrderList].sort((a, b) => {
    const dateA = new Date(a.orderDate).getTime() || 0;
    const dateB = new Date(b.orderDate).getTime() || 0;
    return dateB - dateA;
  });

  if (!cin7Customer && !wooCustomer && allOrders.length === 0) {
    return { found: false, error: "Customer not found" };
  }

  // Prefer Cin7 customer data, fall back to WooCommerce
  const customer = cin7Customer || wooCustomer;

  const totalSpent = allOrders.reduce((sum, o) => sum + o.total, 0);

  return {
    found: true,
    customer: customer
      ? {
          name: cin7Customer
            ? (cin7Customer.name || "")
            : `${wooCustomer.first_name || ""} ${wooCustomer.last_name || ""}`.trim(),
          email: customer.email || "",
          phone: cin7Customer?.phone || wooCustomer?.phone || "",
          company: cin7Customer?.company || wooCustomer?.company || "",
        }
      : undefined,
    orders: allOrders.slice(0, 10),
    summary: {
      totalOrders: allOrders.length,
      totalSpent,
      lastOrderDate: allOrders[0]?.orderDate || null,
    },
  };
}

/**
 * Look up customer by phone number from Supabase cache
 */
export async function lookupCustomerByPhone(
  phone: string
): Promise<CustomerLookupResult> {
  const supabase = createServiceClient() as SupabaseAny;

  // Normalize phone - remove non-digits for flexible matching
  const digits = phone.replace(/\D/g, "");

  // Search customers by phone
  const { data: customer } = await supabase
    .from("cin7_customers")
    .select("*")
    .or(`phone.ilike.%${digits}%,mobile.ilike.%${digits}%`)
    .limit(1)
    .single();

  if (!customer) {
    return { found: false, error: "Customer not found" };
  }

  // Get orders by customer name (since we found the customer)
  const { data: orders } = await supabase
    .from("cin7_orders")
    .select(
      "order_number, status, status_label, order_date, total, tracking_number"
    )
    .ilike("customer_name", customer.name)
    .order("order_date", { ascending: false })
    .limit(10);

  const orderList = orders || [];
  const totalSpent = orderList.reduce(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sum: number, o: any) => sum + (parseFloat(o.total) || 0),
    0
  );

  return {
    found: true,
    customer: {
      name: customer.name || "",
      email: customer.email || "",
      phone: customer.phone || "",
      company: customer.company || "",
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    orders: orderList.map((o: any) => ({
      orderNumber: o.order_number || "",
      status: o.status || "",
      statusLabel: o.status_label || o.status || "",
      orderDate: o.order_date || "",
      total: parseFloat(o.total) || 0,
      trackingNumber: o.tracking_number || null,
    })),
    summary: {
      totalOrders: orderList.length,
      totalSpent,
      lastOrderDate: orderList[0]?.order_date || null,
    },
  };
}

/**
 * Look up customer by name (partial match) from Supabase cache
 */
export async function lookupCustomerByName(
  name: string
): Promise<CustomerLookupResult> {
  const supabase = createServiceClient() as SupabaseAny;

  const { data: customer } = await supabase
    .from("cin7_customers")
    .select("*")
    .ilike("name", `%${name}%`)
    .limit(1)
    .single();

  if (!customer) {
    return { found: false, error: "Customer not found" };
  }

  const { data: orders } = await supabase
    .from("cin7_orders")
    .select(
      "order_number, status, status_label, order_date, total, tracking_number"
    )
    .ilike("customer_name", `%${name}%`)
    .order("order_date", { ascending: false })
    .limit(10);

  const orderList = orders || [];
  const totalSpent = orderList.reduce(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sum: number, o: any) => sum + (parseFloat(o.total) || 0),
    0
  );

  return {
    found: true,
    customer: {
      name: customer.name || "",
      email: customer.email || "",
      phone: customer.phone || "",
      company: customer.company || "",
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    orders: orderList.map((o: any) => ({
      orderNumber: o.order_number || "",
      status: o.status || "",
      statusLabel: o.status_label || o.status || "",
      orderDate: o.order_date || "",
      total: parseFloat(o.total) || 0,
      trackingNumber: o.tracking_number || null,
    })),
    summary: {
      totalOrders: orderList.length,
      totalSpent,
      lastOrderDate: orderList[0]?.order_date || null,
    },
  };
}

/**
 * Format order result for chat response
 * Prominently displays tracking number when available
 */
export function formatOrderForChat(result: OrderLookupResult): string {
  if (!result.found || !result.order) {
    return "I couldn't find that order. Please check the order number and try again, or provide your email address so I can look up your orders.";
  }

  const o = result.order;
  const lines: string[] = [];

  lines.push(`**📦 Order ${o.orderNumber}**`);
  lines.push(`**Status:** ${o.statusLabel}`);
  lines.push(
    `**Date:** ${new Date(o.orderDate).toLocaleDateString("en-AU", { year: "numeric", month: "long", day: "numeric" })}`
  );
  lines.push(`**Total:** $${o.total.toFixed(2)} ${o.currency}`);
  lines.push(`**Customer:** ${o.customerName}`);

  // TRACKING NUMBER - Display prominently
  if (o.trackingNumber) {
    lines.push("");
    lines.push(`**🚚 Tracking Number:** ${o.trackingNumber}`);
    if (o.shippingStatus) {
      lines.push(`**Shipping Status:** ${o.shippingStatus}`);
    }
  } else {
    lines.push("");
    const statusUpper = o.status.toUpperCase();
    if (statusUpper === "COMPLETED" || statusUpper === "SHIPPED") {
      lines.push(
        "🚚 Your order has been dispatched. Tracking information is being processed and will be available shortly."
      );
    } else if (statusUpper === "APPROVED" || statusUpper === "PICKING") {
      lines.push(
        "📋 Your order is being prepared for dispatch. You'll receive tracking information once it ships."
      );
    } else {
      lines.push(
        "Your order has not shipped yet. Once dispatched, you'll receive tracking information."
      );
    }
  }

  // Line items
  if (o.lineItems && o.lineItems.length > 0) {
    lines.push("");
    lines.push("**Items:**");
    o.lineItems.slice(0, 5).forEach((item: { Name?: string; name?: string; ProductName?: string; Quantity?: number; quantity?: number; Qty?: number }) => {
      const name = item.Name || item.name || item.ProductName || "Product";
      const qty = item.Quantity || item.quantity || item.Qty || 1;
      lines.push(`• ${name} (x${qty})`);
    });
    if (o.lineItems.length > 5) {
      lines.push(`• ...and ${o.lineItems.length - 5} more items`);
    }
  }

  return lines.join("\n");
}

/**
 * Format customer lookup result for chat response
 */
export function formatCustomerForChat(result: CustomerLookupResult): string {
  if (!result.found) {
    return "I couldn't find any orders with that information. Please try with your order number (e.g., SO-12345) or the email address you used when placing the order.";
  }

  const lines: string[] = [];

  if (result.customer) {
    lines.push(`**👤 ${result.customer.name}**`);
    if (result.customer.email) {
      lines.push(`Email: ${result.customer.email}`);
    }
  }

  if (result.summary) {
    lines.push("");
    lines.push("**📊 Order Summary:**");
    lines.push(`Total Orders: ${result.summary.totalOrders}`);
    lines.push(`Total Spent: $${result.summary.totalSpent.toFixed(2)}`);
    if (result.summary.lastOrderDate) {
      lines.push(
        `Last Order: ${new Date(result.summary.lastOrderDate).toLocaleDateString("en-AU")}`
      );
    }
  }

  if (result.orders && result.orders.length > 0) {
    lines.push("");
    lines.push("**Recent Orders:**");
    result.orders.slice(0, 5).forEach((o) => {
      const date = new Date(o.orderDate).toLocaleDateString("en-AU", {
        month: "short",
        day: "numeric",
      });
      let line = `• **${o.orderNumber}** - ${o.statusLabel} - $${o.total.toFixed(2)} (${date})`;
      if (o.trackingNumber) {
        line += " 🚚";
      }
      lines.push(line);
    });

    if (result.orders.length > 5) {
      lines.push(`...and ${result.orders.length - 5} more orders`);
    }
  }

  return lines.join("\n");
}
