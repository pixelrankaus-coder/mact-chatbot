/**
 * Chatbot Order/Customer Lookup Library
 * TASK MACT #033: Uses Supabase cache instead of Cin7 API
 *
 * Provides fast, cached lookups for chatbot order inquiries
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
 */
export async function lookupOrderByNumber(
  orderNumber: string
): Promise<OrderLookupResult> {
  const supabase = createServiceClient() as SupabaseAny;

  // Normalize order number - handle with/without SO- prefix
  const normalized = orderNumber.toUpperCase().replace(/^SO-?/i, "");
  const withPrefix = `SO-${normalized}`;
  const withoutPrefix = normalized;

  // Search cin7_orders with multiple patterns
  const { data: cin7Order, error } = await supabase
    .from("cin7_orders")
    .select("*")
    .or(
      `order_number.ilike.${withPrefix},order_number.ilike.SO${withoutPrefix},order_number.ilike.${orderNumber}`
    )
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 = no rows returned
    console.error("Order lookup error:", error);
  }

  if (cin7Order) {
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

  return { found: false, error: "Order not found" };
}

/**
 * Look up customer and their order history by email from Supabase cache
 */
export async function lookupCustomerByEmail(
  email: string
): Promise<CustomerLookupResult> {
  const supabase = createServiceClient() as SupabaseAny;
  const normalizedEmail = email.toLowerCase().trim();

  // Get customer from cache
  const { data: customer } = await supabase
    .from("cin7_customers")
    .select("*")
    .ilike("email", normalizedEmail)
    .limit(1)
    .single();

  // Get all orders for this email
  const { data: orders } = await supabase
    .from("cin7_orders")
    .select(
      "order_number, status, status_label, order_date, total, tracking_number"
    )
    .ilike("customer_email", normalizedEmail)
    .order("order_date", { ascending: false })
    .limit(10);

  if (!customer && (!orders || orders.length === 0)) {
    return { found: false, error: "Customer not found" };
  }

  const orderList = orders || [];
  const totalSpent = orderList.reduce(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sum: number, o: any) => sum + (parseFloat(o.total) || 0),
    0
  );

  return {
    found: true,
    customer: customer
      ? {
          name: customer.name || "",
          email: customer.email || "",
          phone: customer.phone || "",
          company: customer.company || "",
        }
      : undefined,
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
