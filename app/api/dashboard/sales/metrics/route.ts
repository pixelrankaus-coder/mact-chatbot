import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

/**
 * GET /api/dashboard/sales/metrics
 * Returns dashboard metrics: revenue, orders, balance, income, expenses, tax
 */
export async function GET() {
  try {
    const supabase = createServiceClient();

    // Get date ranges
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    // Current period (last 30 days)
    const { data: currentOrders, error: currentError } = await supabase
      .from("cin7_orders")
      .select("total, status, order_date")
      .gte("order_date", thirtyDaysAgo.toISOString().split("T")[0]);

    if (currentError) {
      console.error("Error fetching current orders:", currentError);
      throw currentError;
    }

    // Previous period (30-60 days ago) for comparison
    const { data: previousOrders, error: previousError } = await supabase
      .from("cin7_orders")
      .select("total, status")
      .gte("order_date", sixtyDaysAgo.toISOString().split("T")[0])
      .lt("order_date", thirtyDaysAgo.toISOString().split("T")[0]);

    if (previousError) {
      console.error("Error fetching previous orders:", previousError);
    }

    // Calculate current period metrics
    const currentRevenue = (currentOrders || []).reduce(
      (sum, o) => sum + (parseFloat(String(o.total)) || 0),
      0
    );
    const currentOrderCount = currentOrders?.length || 0;

    // Calculate previous period metrics for comparison
    const previousRevenue = (previousOrders || []).reduce(
      (sum, o) => sum + (parseFloat(String(o.total)) || 0),
      0
    );
    const previousOrderCount = previousOrders?.length || 0;

    // Calculate percentage changes
    const revenueChange = previousRevenue > 0
      ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
      : 0;
    const ordersChange = previousOrderCount > 0
      ? ((currentOrderCount - previousOrderCount) / previousOrderCount) * 100
      : 0;

    // Get total counts
    const { count: totalOrders } = await supabase
      .from("cin7_orders")
      .select("*", { count: "exact", head: true });

    const { count: totalCustomers } = await supabase
      .from("cin7_customers")
      .select("*", { count: "exact", head: true });

    // Calculate status-based metrics
    const completedStatuses = ["COMPLETED", "SHIPPED", "INVOICED"];
    const completedOrders = (currentOrders || []).filter(o =>
      completedStatuses.includes(o.status)
    );
    const income = completedOrders.reduce(
      (sum, o) => sum + (parseFloat(String(o.total)) || 0),
      0
    );

    // Outstanding/pending orders (balance)
    const pendingStatuses = ["DRAFT", "ORDERING", "APPROVED", "PICKING", "PACKED"];
    const pendingOrders = (currentOrders || []).filter(o =>
      pendingStatuses.includes(o.status)
    );
    const balance = pendingOrders.reduce(
      (sum, o) => sum + (parseFloat(String(o.total)) || 0),
      0
    );

    // Estimate tax (10% GST for Australia)
    const taxRate = 0.1;
    const tax = income * taxRate;

    // Estimate expenses (placeholder - would need actual expense data)
    const expenses = income * 0.15; // Rough estimate

    return NextResponse.json({
      revenue: {
        value: currentRevenue,
        change: revenueChange,
        period: "30d",
      },
      orders: {
        value: currentOrderCount,
        change: ordersChange,
        total: totalOrders || 0,
      },
      customers: {
        total: totalCustomers || 0,
      },
      balance: {
        value: balance,
        label: "Outstanding",
      },
      income: {
        value: income,
        label: "Completed Revenue",
      },
      expenses: {
        value: expenses,
        label: "Est. Expenses",
      },
      tax: {
        value: tax,
        label: "Est. GST",
      },
    });
  } catch (error) {
    console.error("Dashboard metrics error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard metrics" },
      { status: 500 }
    );
  }
}
