import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

/**
 * GET /api/dashboard/sales/orders/recent
 * Returns recent orders for the dashboard table
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const status = searchParams.get("status");

  try {
    const supabase = createServiceClient();

    let query = supabase
      .from("cin7_orders")
      .select(`
        cin7_id,
        order_number,
        status,
        status_label,
        order_date,
        customer_name,
        customer_email,
        total,
        currency,
        tracking_number,
        shipping_status,
        line_items
      `)
      .order("order_date", { ascending: false })
      .limit(limit);

    if (status && status !== "all") {
      query = query.eq("status", status.toUpperCase());
    }

    const { data: orders, error } = await query;

    if (error) {
      console.error("Error fetching recent orders:", error);
      throw error;
    }

    // Transform for dashboard display
    const transformedOrders = (orders || []).map((order) => ({
      id: order.cin7_id,
      orderNumber: order.order_number,
      customer: order.customer_name,
      email: order.customer_email,
      items: Array.isArray(order.line_items) ? order.line_items.length : 0,
      amount: parseFloat(String(order.total)) || 0,
      currency: order.currency || "AUD",
      status: order.status,
      statusLabel: order.status_label || order.status,
      date: order.order_date,
      tracking: order.tracking_number,
      shippingStatus: order.shipping_status,
    }));

    return NextResponse.json({
      orders: transformedOrders,
      count: transformedOrders.length,
    });
  } catch (error) {
    console.error("Recent orders error:", error);
    return NextResponse.json(
      { error: "Failed to fetch recent orders" },
      { status: 500 }
    );
  }
}
