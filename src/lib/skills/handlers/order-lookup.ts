/**
 * Order Lookup Skill Handler
 * TASK: AI Agent Skills Tab - Phase 1
 *
 * Allows the AI to look up orders from cached Cin7/WooCommerce data
 */

import { registerSkill, SkillContext, SkillResult } from "../index";
import { createServiceClient } from "@/lib/supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any;

interface OrderLookupParams {
  order_number?: string;
  email?: string;
  phone?: string;
}

async function orderLookupHandler(
  params: Record<string, unknown>,
  context: SkillContext
): Promise<SkillResult> {
  const { order_number, email, phone } = params as OrderLookupParams;

  if (!order_number && !email && !phone) {
    return {
      success: false,
      error: "Please provide an order number, email, or phone number to search",
    };
  }

  const supabase = createServiceClient() as SupabaseAny;

  try {
    // Try Cin7 orders first
    let orders = await searchCin7Orders(supabase, { order_number, email, phone });

    // If no Cin7 results, try WooCommerce
    if (orders.length === 0) {
      orders = await searchWooOrders(supabase, { order_number, email, phone });
    }

    if (orders.length === 0) {
      return {
        success: true,
        data: { orders: [] },
        message: `No orders found for ${order_number || email || phone}`,
      };
    }

    return {
      success: true,
      data: {
        orders: orders.slice(0, 5), // Limit to 5 most recent
        total: orders.length,
      },
      message: `Found ${orders.length} order(s)`,
    };
  } catch (error) {
    console.error("Order lookup error:", error);
    return {
      success: false,
      error: "Failed to search orders. Please try again.",
    };
  }
}

async function searchCin7Orders(
  supabase: SupabaseAny,
  { order_number, email, phone }: OrderLookupParams
): Promise<Array<Record<string, unknown>>> {
  let query = supabase.from("cin7_orders_cache").select("*");

  if (order_number) {
    // Search by order reference or ID
    query = query.or(`order_ref.ilike.%${order_number}%,id.eq.${order_number}`);
  } else if (email) {
    query = query.ilike("customer_email", `%${email}%`);
  } else if (phone) {
    query = query.or(`billing_phone.ilike.%${phone}%,shipping_phone.ilike.%${phone}%`);
  }

  const { data, error } = await query.order("order_date", { ascending: false }).limit(10);

  if (error || !data) return [];

  return data.map((order: Record<string, unknown>) => ({
    source: "cin7",
    order_number: order.order_ref || order.id,
    status: order.status,
    total: order.total,
    currency: order.currency || "AUD",
    date: order.order_date,
    customer_name: order.customer_name,
    customer_email: order.customer_email,
    items_count: (order.line_items as unknown[])?.length || 0,
  }));
}

async function searchWooOrders(
  supabase: SupabaseAny,
  { order_number, email, phone }: OrderLookupParams
): Promise<Array<Record<string, unknown>>> {
  let query = supabase.from("woo_orders_cache").select("*");

  if (order_number) {
    // WooCommerce orders typically use numeric IDs
    query = query.or(`order_number.eq.${order_number},id.eq.${order_number}`);
  } else if (email) {
    query = query.ilike("billing_email", `%${email}%`);
  } else if (phone) {
    query = query.or(`billing_phone.ilike.%${phone}%,shipping_phone.ilike.%${phone}%`);
  }

  const { data, error } = await query.order("date_created", { ascending: false }).limit(10);

  if (error || !data) return [];

  return data.map((order: Record<string, unknown>) => ({
    source: "woocommerce",
    order_number: order.order_number || order.id,
    status: order.status,
    total: order.total,
    currency: order.currency || "AUD",
    date: order.date_created,
    customer_name: `${order.billing_first_name || ""} ${order.billing_last_name || ""}`.trim(),
    customer_email: order.billing_email,
    items_count: (order.line_items as unknown[])?.length || 0,
  }));
}

// Register the skill
registerSkill({
  slug: "order_lookup",
  name: "Order Lookup",
  description:
    "Look up customer orders by order number, email address, or phone number. Returns order details including status, total, and item count.",
  parameters: {
    type: "object",
    properties: {
      order_number: {
        type: "string",
        description: "The order number or order reference to search for",
      },
      email: {
        type: "string",
        description: "Customer email address to search orders by",
      },
      phone: {
        type: "string",
        description: "Customer phone number to search orders by",
      },
    },
  },
  handler: orderLookupHandler,
});

export default orderLookupHandler;
