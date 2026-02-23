import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

/**
 * GET /api/dashboard/sales/orders/recent
 * Returns recent orders from both Cin7 and WooCommerce for the dashboard table
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const status = searchParams.get("status");
  const source = searchParams.get("source") || "all";
  const includeCin7 = source === "all" || source === "cin7";
  const includeWoo = source === "all" || source === "woocommerce";

  try {
    const supabase = createServiceClient();

    // Fetch from selected sources
    let cin7Query = supabase
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

    let wooQuery = supabase
      .from("woo_orders")
      .select(`
        woo_id,
        order_number,
        status,
        status_label,
        order_date,
        customer_name,
        customer_email,
        total,
        currency,
        tracking_number,
        line_items
      `)
      .order("order_date", { ascending: false })
      .limit(limit);

    if (status && status !== "all") {
      cin7Query = cin7Query.eq("status", status.toUpperCase());
      wooQuery = wooQuery.eq("status", status.toLowerCase());
    }

    const [cin7Result, wooResult] = await Promise.all([
      includeCin7 ? cin7Query : Promise.resolve({ data: [], error: null }),
      includeWoo ? wooQuery : Promise.resolve({ data: [], error: null }),
    ]);

    if (cin7Result.error) console.error("Cin7 recent orders error:", cin7Result.error);
    if (wooResult.error) console.error("Woo recent orders error:", wooResult.error);

    // Transform Cin7 orders
    const cin7Orders = (cin7Result.data || []).map((order) => ({
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
      source: "cin7",
    }));

    // WooCommerce status labels
    const wooStatusLabels: Record<string, string> = {
      pending: "Pending",
      processing: "Processing",
      "on-hold": "On Hold",
      completed: "Completed",
      cancelled: "Cancelled",
      refunded: "Refunded",
      failed: "Failed",
    };

    // Transform WooCommerce orders
    const wooOrders = (wooResult.data || []).map((order) => ({
      id: String(order.woo_id),
      orderNumber: `#${order.order_number || order.woo_id}`,
      customer: order.customer_name || order.customer_email || "Guest",
      email: order.customer_email,
      items: Array.isArray(order.line_items) ? order.line_items.length : 0,
      amount: parseFloat(String(order.total)) || 0,
      currency: order.currency || "AUD",
      status: order.status,
      statusLabel: order.status_label || wooStatusLabels[order.status] || order.status,
      date: order.order_date,
      tracking: order.tracking_number,
      source: "woocommerce",
    }));

    // Merge and sort by date, take the most recent entries
    const allOrders = [...cin7Orders, ...wooOrders]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit);

    return NextResponse.json({
      orders: allOrders,
      count: allOrders.length,
    });
  } catch (error) {
    console.error("Recent orders error:", error);
    return NextResponse.json(
      { error: "Failed to fetch recent orders" },
      { status: 500 }
    );
  }
}
