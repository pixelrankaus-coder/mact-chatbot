import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import type { OrderSource, UnifiedOrder } from "@/types/order";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any;

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const search = searchParams.get("search") || "";
  const source = searchParams.get("source") as OrderSource | null;
  const status = searchParams.get("status") || "";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "25", 10);
  const offset = (page - 1) * limit;

  try {
    const supabase = createServiceClient() as SupabaseAny;

    // Fetch Cin7 orders from Supabase cache
    let cin7Orders: UnifiedOrder[] = [];
    let cin7Total = 0;

    if (source !== "woocommerce") {
      let query = supabase
        .from("cin7_orders")
        .select("*", { count: "exact" })
        .order("order_date", { ascending: false });

      // Apply search filter
      if (search) {
        query = query.or(
          `order_number.ilike.%${search}%,customer_name.ilike.%${search}%`
        );
      }

      // Apply status filter
      if (status) {
        query = query.eq("status", status.toUpperCase());
      }

      // Pagination
      query = query.range(offset, offset + limit - 1);

      const { data: cin7Data, count, error } = await query;

      if (error) {
        console.error("Supabase cin7_orders query error:", error);
      } else {
        cin7Total = count || 0;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cin7Orders = (cin7Data || []).map((o: any) => ({
          id: `cin7-${o.cin7_id}`,
          cin7Id: o.cin7_id,
          orderNumber: o.order_number || "",
          source: "cin7" as const,
          status: o.status || "",
          statusLabel: o.status_label || o.status || "",
          orderDate: o.order_date || "",
          total: parseFloat(String(o.total)) || 0,
          currency: o.currency || "AUD",
          customerName: o.customer_name || "",
          customerEmail: o.customer_email || "",
          customerId: o.customer_id || "",
          trackingNumber: o.tracking_number || undefined,
          items: o.line_items || [],
          lastUpdated: o.updated_at || "",
        }));
      }
    }

    // Fetch WooCommerce orders from Supabase cache (synced via cron)
    let wooOrders: UnifiedOrder[] = [];
    let wooTotal = 0;

    if (source !== "cin7") {
      let wooQuery = supabase
        .from("woo_orders")
        .select("*", { count: "exact" })
        .order("order_date", { ascending: false });

      // Apply search filter
      if (search) {
        wooQuery = wooQuery.or(
          `order_number.ilike.%${search}%,customer_name.ilike.%${search}%,customer_email.ilike.%${search}%`
        );
      }

      // Apply status filter
      if (status) {
        wooQuery = wooQuery.eq("status", status.toLowerCase());
      }

      // Pagination
      wooQuery = wooQuery.range(offset, offset + limit - 1);

      const { data: wooData, count: wooCount, error: wooError } = await wooQuery;

      if (wooError) {
        console.error("Supabase woo_orders query error:", wooError);
      } else {
        wooTotal = wooCount || 0;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        wooOrders = (wooData || []).map((o: any) => ({
          id: `woo-${o.woo_id}`,
          wooId: o.woo_id,
          orderNumber: o.order_number || `#${o.woo_id}`,
          source: "woocommerce" as const,
          status: o.status || "",
          statusLabel: o.status_label || (o.status ? o.status.charAt(0).toUpperCase() + o.status.slice(1).replace(/-/g, " ") : ""),
          orderDate: o.order_date || "",
          total: parseFloat(String(o.total)) || 0,
          currency: o.currency || "AUD",
          customerName: o.customer_name || "Guest",
          customerEmail: o.customer_email || "",
          customerId: o.customer_id ? String(o.customer_id) : "",
          trackingNumber: o.tracking_number || undefined,
          items: o.line_items || [],
          lastUpdated: o.updated_at || o.order_date || "",
        }));
      }
    }

    // Merge orders from both sources
    const allOrders = [...cin7Orders, ...wooOrders];

    // Sort by date (newest first)
    allOrders.sort((a, b) => {
      const dateA = new Date(a.orderDate).getTime();
      const dateB = new Date(b.orderDate).getTime();
      return dateB - dateA;
    });

    // Build stats
    const stats = {
      cin7: cin7Total,
      woocommerce: wooTotal,
      total: cin7Total + wooTotal,
    };

    // Determine total based on source filter
    let filteredTotal = stats.total;
    if (source === "cin7") {
      filteredTotal = cin7Total;
    } else if (source === "woocommerce") {
      filteredTotal = wooTotal;
    }

    return NextResponse.json({
      orders: allOrders,
      total: filteredTotal,
      page,
      limit,
      stats,
    });
  } catch (error) {
    console.error("Unified orders API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}
