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

    // 1. Cin7 product data — try exact match, then base SKU match for variants
    let { data: cin7Product } = await supabase
      .from("cin7_products")
      .select("*")
      .eq("sku", sku)
      .single();

    let cin7Variants: SA[] = [];
    if (!cin7Product) {
      const { data: variants } = await supabase
        .from("cin7_products")
        .select("*")
        .like("sku", `${sku}-%`);
      cin7Variants = variants || [];
      if (cin7Variants.length > 0) cin7Product = cin7Variants[0];
    }

    // 2. WooCommerce product (may not exist)
    const { data: wooProduct } = await supabase
      .from("woo_products")
      .select("*")
      .eq("sku", sku)
      .single();

    if (!cin7Product && !wooProduct) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Collect all related SKUs for sales lookup (base SKU + all variants)
    const relatedSkus = new Set<string>([sku]);
    if (cin7Product) relatedSkus.add(cin7Product.sku);
    for (const v of cin7Variants) relatedSkus.add(v.sku);
    const skuList = Array.from(relatedSkus);

    // 3. Stock levels per location — aggregate across variants
    let stockLocations: Record<string, unknown>[] = [];
    const cin7Ids = cin7Variants.length > 0
      ? cin7Variants.map((v: SA) => v.cin7_id).filter(Boolean)
      : cin7Product?.cin7_id ? [cin7Product.cin7_id] : [];

    if (cin7Ids.length > 0) {
      const { data: stock } = await supabase
        .from("cin7_product_stock")
        .select("location, on_hand, allocated, available, on_order, in_transit, stock_on_hand, bin, last_synced_at")
        .in("cin7_product_id", cin7Ids);
      stockLocations = stock || [];
    }

    // 4. Cin7 Sales history (last 50) — all related SKUs
    const { data: cin7SalesRaw } = await supabase
      .from("cin7_order_items")
      .select("order_number, order_date, product_name, quantity, unit_price, total_price, category")
      .in("sku", skuList)
      .order("order_date", { ascending: false })
      .limit(50);

    let cin7Sales: SA[] = [];
    if (cin7SalesRaw && cin7SalesRaw.length > 0) {
      const orderNumbers = [...new Set(cin7SalesRaw.map((s: SA) => s.order_number))];
      const { data: orders } = await supabase
        .from("cin7_orders")
        .select("order_number, customer_name, status, status_label, invoice_status")
        .in("order_number", orderNumbers);
      const orderMap = new Map<string, SA>();
      if (orders) for (const o of orders) orderMap.set(o.order_number, o);

      cin7Sales = cin7SalesRaw.map((s: SA) => {
        const order = orderMap.get(s.order_number);
        return { ...s, customer_name: order?.customer_name || "Unknown", order_status: order?.status_label || order?.status || "Unknown", source: "cin7" };
      });
    }

    const enrichedSalesHistory = cin7Sales;

    // 6. All Cin7 sales for stats
    const { data: allCin7Sales } = await supabase
      .from("cin7_order_items")
      .select("quantity, total_price, order_date")
      .in("sku", skuList);

    const salesStats = {
      totalRevenue: 0, totalUnitsSold: 0, orderCount: 0, avgOrderValue: 0,
      firstOrderDate: null as string | null, lastOrderDate: null as string | null,
    };

    if (allCin7Sales && allCin7Sales.length > 0) {
      salesStats.orderCount = allCin7Sales.length;
      salesStats.totalRevenue = allCin7Sales.reduce((sum: number, s: SA) => sum + (s.total_price || 0), 0);
      salesStats.totalUnitsSold = allCin7Sales.reduce((sum: number, s: SA) => sum + (s.quantity || 0), 0);
      salesStats.avgOrderValue = salesStats.totalRevenue / salesStats.orderCount;
      const dates = allCin7Sales.map((s: SA) => s.order_date).filter(Boolean).sort();
      salesStats.firstOrderDate = dates[0] || null;
      salesStats.lastOrderDate = dates[dates.length - 1] || null;
    }

    // 7. Monthly sales trend (last 12 months, Cin7 only)
    const monthlySales: Record<string, { revenue: number; units: number; orders: number }> = {};
    for (const s of (allCin7Sales || []) as SA[]) {
      if (!s.order_date) continue;
      const month = typeof s.order_date === "string" ? s.order_date.slice(0, 7) : "";
      if (!month) continue;
      if (!monthlySales[month]) monthlySales[month] = { revenue: 0, units: 0, orders: 0 };
      monthlySales[month].revenue += s.total_price || 0;
      monthlySales[month].units += s.quantity || 0;
      monthlySales[month].orders += 1;
    }

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
