import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

/**
 * GET /api/dashboard/sales/orders/status
 * Returns order status distribution for the dashboard
 */
export async function GET() {
  try {
    const supabase = createServiceClient();

    // Get date ranges for comparison
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    // Current period orders by status
    const { data: currentOrders, error: currentError } = await supabase
      .from("cin7_orders")
      .select("status")
      .gte("order_date", thirtyDaysAgo.toISOString().split("T")[0]);

    if (currentError) {
      console.error("Error fetching current orders:", currentError);
      throw currentError;
    }

    // Previous period for comparison
    const { data: previousOrders, error: previousError } = await supabase
      .from("cin7_orders")
      .select("status")
      .gte("order_date", sixtyDaysAgo.toISOString().split("T")[0])
      .lt("order_date", thirtyDaysAgo.toISOString().split("T")[0]);

    if (previousError) {
      console.error("Error fetching previous orders:", previousError);
    }

    // Count by status - current period
    const statusCounts: Record<string, number> = {};
    (currentOrders || []).forEach((order) => {
      const status = order.status || "UNKNOWN";
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    // Count by status - previous period
    const prevStatusCounts: Record<string, number> = {};
    (previousOrders || []).forEach((order) => {
      const status = order.status || "UNKNOWN";
      prevStatusCounts[status] = (prevStatusCounts[status] || 0) + 1;
    });

    // Map to dashboard format with categories
    const statusMapping: Record<string, { label: string; category: string }> = {
      DRAFT: { label: "Draft", category: "new" },
      ORDERING: { label: "New Order", category: "new" },
      APPROVED: { label: "Approved", category: "in_progress" },
      PICKING: { label: "Picking", category: "in_progress" },
      PACKED: { label: "Packed", category: "in_progress" },
      SHIPPED: { label: "Shipped", category: "completed" },
      INVOICED: { label: "Invoiced", category: "completed" },
      COMPLETED: { label: "Completed", category: "completed" },
      CANCELLED: { label: "Cancelled", category: "cancelled" },
      VOID: { label: "Void", category: "cancelled" },
    };

    // Aggregate by category
    const categories = {
      new: { count: 0, prevCount: 0, label: "New Orders" },
      in_progress: { count: 0, prevCount: 0, label: "In Progress" },
      completed: { count: 0, prevCount: 0, label: "Completed" },
      cancelled: { count: 0, prevCount: 0, label: "Cancelled/Returns" },
    };

    Object.entries(statusCounts).forEach(([status, count]) => {
      const mapping = statusMapping[status];
      if (mapping) {
        const cat = mapping.category as keyof typeof categories;
        categories[cat].count += count;
      }
    });

    Object.entries(prevStatusCounts).forEach(([status, count]) => {
      const mapping = statusMapping[status];
      if (mapping) {
        const cat = mapping.category as keyof typeof categories;
        categories[cat].prevCount += count;
      }
    });

    // Calculate total and percentages
    const total = Object.values(categories).reduce((sum, c) => sum + c.count, 0);

    const statusDistribution = Object.entries(categories).map(([key, data]) => {
      const change = data.prevCount > 0
        ? ((data.count - data.prevCount) / data.prevCount) * 100
        : 0;

      return {
        id: key,
        label: data.label,
        count: data.count,
        percentage: total > 0 ? (data.count / total) * 100 : 0,
        change: change,
      };
    });

    // Also return detailed status breakdown
    const detailedStatus = Object.entries(statusCounts)
      .map(([status, count]) => ({
        status,
        label: statusMapping[status]?.label || status,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      summary: statusDistribution,
      detailed: detailedStatus,
      total,
      period: "30d",
    });
  } catch (error) {
    console.error("Order status error:", error);
    return NextResponse.json(
      { error: "Failed to fetch order status" },
      { status: 500 }
    );
  }
}
