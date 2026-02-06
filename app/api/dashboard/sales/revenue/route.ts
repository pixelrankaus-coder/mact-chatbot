import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

/**
 * GET /api/dashboard/sales/revenue
 * Returns revenue chart data for the dashboard
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const period = searchParams.get("period") || "28d";
  const interval = searchParams.get("interval") || "daily";

  try {
    const supabase = createServiceClient();

    // Calculate date range
    const now = new Date();
    const daysBack = parseInt(period.replace("d", ""), 10) || 28;
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - daysBack);

    // Fetch orders in date range
    const { data: orders, error } = await supabase
      .from("cin7_orders")
      .select("total, order_date, status")
      .gte("order_date", startDate.toISOString().split("T")[0])
      .order("order_date", { ascending: true });

    if (error) {
      console.error("Error fetching revenue data:", error);
      throw error;
    }

    // Group by date
    const revenueByDate: Record<string, { revenue: number; orders: number }> = {};

    // Initialize all dates in range
    for (let d = new Date(startDate); d <= now; d.setDate(d.getDate() + 1)) {
      const dateKey = d.toISOString().split("T")[0];
      revenueByDate[dateKey] = { revenue: 0, orders: 0 };
    }

    // Aggregate orders by date
    (orders || []).forEach((order) => {
      const dateKey = order.order_date?.split("T")[0];
      if (dateKey && revenueByDate[dateKey]) {
        revenueByDate[dateKey].revenue += parseFloat(String(order.total)) || 0;
        revenueByDate[dateKey].orders += 1;
      }
    });

    // Convert to array format for charts
    const chartData = Object.entries(revenueByDate)
      .map(([date, data]) => ({
        date,
        revenue: Math.round(data.revenue * 100) / 100,
        orders: data.orders,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculate totals
    const totalRevenue = chartData.reduce((sum, d) => sum + d.revenue, 0);
    const totalOrders = chartData.reduce((sum, d) => sum + d.orders, 0);
    const avgDaily = totalRevenue / chartData.length;

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
      interval,
    });
  } catch (error) {
    console.error("Revenue chart error:", error);
    return NextResponse.json(
      { error: "Failed to fetch revenue data" },
      { status: 500 }
    );
  }
}
