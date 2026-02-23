import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

/**
 * GET /api/dashboard/sales/revenue
 * Returns revenue chart data combining Cin7 + WooCommerce
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const period = searchParams.get("period") || "28d";
  const source = searchParams.get("source") || "all";
  const includeCin7 = source === "all" || source === "cin7";
  const includeWoo = source === "all" || source === "woocommerce";

  try {
    const supabase = createServiceClient();

    // Calculate date range
    const now = new Date();
    const daysBack = parseInt(period.replace("d", ""), 10) || 28;
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - daysBack);
    const startDateStr = startDate.toISOString().split("T")[0];

    // Fetch from sources based on filter
    const [cin7Result, wooResult] = await Promise.all([
      includeCin7
        ? supabase.from("cin7_orders").select("total, order_date, status").gte("order_date", startDateStr).order("order_date", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      includeWoo
        ? supabase.from("woo_orders").select("total, order_date, status").gte("order_date", startDateStr).order("order_date", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (cin7Result.error) console.error("Cin7 revenue error:", cin7Result.error);
    if (wooResult.error) console.error("Woo revenue error:", wooResult.error);

    const cin7Orders = cin7Result.data || [];
    const wooOrders = wooResult.data || [];

    // Group by date - initialize all dates in range
    const revenueByDate: Record<string, { revenue: number; orders: number; cin7Revenue: number; wooRevenue: number }> = {};
    for (let d = new Date(startDate); d <= now; d.setDate(d.getDate() + 1)) {
      const dateKey = d.toISOString().split("T")[0];
      revenueByDate[dateKey] = { revenue: 0, orders: 0, cin7Revenue: 0, wooRevenue: 0 };
    }

    // Aggregate Cin7 orders
    cin7Orders.forEach((order) => {
      const dateKey = order.order_date?.split("T")[0];
      if (dateKey && revenueByDate[dateKey]) {
        const amount = parseFloat(String(order.total)) || 0;
        revenueByDate[dateKey].revenue += amount;
        revenueByDate[dateKey].cin7Revenue += amount;
        revenueByDate[dateKey].orders += 1;
      }
    });

    // Aggregate WooCommerce orders
    wooOrders.forEach((order) => {
      const dateKey = order.order_date?.split("T")[0];
      if (dateKey && revenueByDate[dateKey]) {
        const amount = parseFloat(String(order.total)) || 0;
        revenueByDate[dateKey].revenue += amount;
        revenueByDate[dateKey].wooRevenue += amount;
        revenueByDate[dateKey].orders += 1;
      }
    });

    // Convert to chart array
    const chartData = Object.entries(revenueByDate)
      .map(([date, data]) => ({
        date,
        revenue: Math.round(data.revenue * 100) / 100,
        orders: data.orders,
        cin7Revenue: Math.round(data.cin7Revenue * 100) / 100,
        wooRevenue: Math.round(data.wooRevenue * 100) / 100,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculate totals
    const totalRevenue = chartData.reduce((sum, d) => sum + d.revenue, 0);
    const totalOrders = chartData.reduce((sum, d) => sum + d.orders, 0);
    const avgDaily = chartData.length > 0 ? totalRevenue / chartData.length : 0;

    // Find peak day
    const peakDay = chartData.reduce(
      (max, d) => (d.revenue > max.revenue ? d : max),
      chartData[0] || { date: "", revenue: 0, orders: 0 }
    );

    return NextResponse.json({
      data: chartData,
      summary: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalOrders,
        avgDailyRevenue: Math.round(avgDaily * 100) / 100,
        peakDay: {
          date: peakDay?.date,
          revenue: peakDay?.revenue,
        },
      },
      period,
      interval: "daily",
    });
  } catch (error) {
    console.error("Revenue chart error:", error);
    return NextResponse.json(
      { error: "Failed to fetch revenue data" },
      { status: 500 }
    );
  }
}
