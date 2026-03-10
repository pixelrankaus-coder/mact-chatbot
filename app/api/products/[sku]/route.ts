import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SA = any;

/**
 * GET /api/products/[sku]
 * Returns full product detail: cin7 product + stock + sales history + woo data
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sku: string }> }
) {
  const { sku } = await params;

  try {
    const supabase = createServiceClient() as SA;

    // 1. Cin7 product data
    const { data: cin7Product } = await supabase
      .from("cin7_products")
      .select("*")
      .eq("sku", sku)
      .single();

    // 2. WooCommerce product (may not exist)
    const { data: wooProduct } = await supabase
      .from("woo_products")
      .select("*")
      .eq("sku", sku)
      .single();

    if (!cin7Product && !wooProduct) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // 3. Stock levels per location
    let stockLocations: Record<string, unknown>[] = [];
    if (cin7Product?.cin7_id) {
      const { data: stock } = await supabase
        .from("cin7_product_stock")
        .select("location, on_hand, allocated, available, on_order, in_transit, stock_on_hand, bin, last_synced_at")
        .eq("cin7_product_id", cin7Product.cin7_id);
      stockLocations = stock || [];
    }

    // 4. Sales history from cin7_order_items (last 50 orders)
    const { data: salesHistory } = await supabase
      .from("cin7_order_items")
      .select("order_number, order_date, product_name, quantity, unit_price, total_price, category")
      .eq("sku", sku)
      .order("order_date", { ascending: false })
      .limit(50);

    // 5. Sales summary stats
    const { data: allSales } = await supabase
      .from("cin7_order_items")
      .select("quantity, total_price, order_date")
      .eq("sku", sku);

    const salesStats = {
      totalRevenue: 0,
      totalUnitsSold: 0,
      orderCount: 0,
      avgOrderValue: 0,
      firstOrderDate: null as string | null,
      lastOrderDate: null as string | null,
    };

    if (allSales && allSales.length > 0) {
      salesStats.orderCount = allSales.length;
      salesStats.totalRevenue = allSales.reduce((sum: number, s: SA) => sum + (s.total_price || 0), 0);
      salesStats.totalUnitsSold = allSales.reduce((sum: number, s: SA) => sum + (s.quantity || 0), 0);
      salesStats.avgOrderValue = salesStats.totalRevenue / salesStats.orderCount;

      const dates = allSales.map((s: SA) => s.order_date).filter(Boolean).sort();
      salesStats.firstOrderDate = dates[0] || null;
      salesStats.lastOrderDate = dates[dates.length - 1] || null;
    }

    // 6. Get order details for sales history (customer name, status)
    let enrichedSalesHistory = salesHistory || [];
    if (salesHistory && salesHistory.length > 0) {
      const orderNumbers = [...new Set(salesHistory.map((s: SA) => s.order_number))];
      const { data: orders } = await supabase
        .from("cin7_orders")
        .select("order_number, customer_name, status, status_label, invoice_status")
        .in("order_number", orderNumbers);

      const orderMap = new Map<string, SA>();
      if (orders) {
        for (const o of orders) {
          orderMap.set(o.order_number, o);
        }
      }

      enrichedSalesHistory = salesHistory.map((s: SA) => {
        const order = orderMap.get(s.order_number);
        return {
          ...s,
          customer_name: order?.customer_name || "Unknown",
          order_status: order?.status_label || order?.status || "Unknown",
          invoice_status: order?.invoice_status || null,
        };
      });
    }

    // 7. Monthly sales trend (last 12 months)
    const monthlySales: Record<string, { revenue: number; units: number; orders: number }> = {};
    if (allSales) {
      for (const s of allSales as SA[]) {
        if (!s.order_date) continue;
        const month = s.order_date.slice(0, 7); // YYYY-MM
        if (!monthlySales[month]) monthlySales[month] = { revenue: 0, units: 0, orders: 0 };
        monthlySales[month].revenue += s.total_price || 0;
        monthlySales[month].units += s.quantity || 0;
        monthlySales[month].orders += 1;
      }
    }

    // Sort by month and take last 12
    const salesTrend = Object.entries(monthlySales)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, data]) => ({ month, ...data }));

    // Aggregate stock totals
    const stockTotals = {
      totalOnHand: stockLocations.reduce((sum, s: SA) => sum + (s.on_hand || 0), 0),
      totalAvailable: stockLocations.reduce((sum, s: SA) => sum + (s.available || 0), 0),
      totalAllocated: stockLocations.reduce((sum, s: SA) => sum + (s.allocated || 0), 0),
      totalOnOrder: stockLocations.reduce((sum, s: SA) => sum + (s.on_order || 0), 0),
      totalInTransit: stockLocations.reduce((sum, s: SA) => sum + (s.in_transit || 0), 0),
    };

    return NextResponse.json({
      cin7Product,
      wooProduct,
      stockLocations,
      stockTotals,
      salesHistory: enrichedSalesHistory,
      salesStats,
      salesTrend,
    });
  } catch (error) {
    console.error("Product detail API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch product details" },
      { status: 500 }
    );
  }
}
