import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// Cin7 status → category mapping
const CIN7_STATUS_MAP: Record<string, string> = {
  DRAFT: "new",
  ESTIMATED: "new",
  ESTIMATING: "new",
  ORDERING: "new",
  ORDERED: "in_progress",
  APPROVED: "in_progress",
  PICKING: "in_progress",
  PACKED: "in_progress",
  BACKORDERED: "in_progress",
  INVOICING: "in_progress",
  SHIPPED: "completed",
  INVOICED: "completed",
  COMPLETED: "completed",
  CLOSED: "completed",
  CREDITED: "completed",
  CANCELLED: "cancelled",
  VOID: "cancelled",
  VOIDED: "cancelled",
};

// WooCommerce status → category mapping
const WOO_STATUS_MAP: Record<string, string> = {
  pending: "new",
  processing: "in_progress",
  "on-hold": "in_progress",
  completed: "completed",
  cancelled: "cancelled",
  refunded: "cancelled",
  failed: "cancelled",
};

/**
 * GET /api/dashboard/sales/orders/status
 * Returns order status distribution combining Cin7 + WooCommerce
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const source = req.nextUrl.searchParams.get("source") || "all";
    const includeCin7 = source === "all" || source === "cin7";
    const includeWoo = source === "all" || source === "woocommerce";

    // Get date ranges for comparison
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const currentDate = thirtyDaysAgo.toISOString().split("T")[0];
    const previousDate = sixtyDaysAgo.toISOString().split("T")[0];

    // Fetch current and previous period from selected sources
    const [cin7Current, cin7Previous, wooCurrent, wooPrevious] = await Promise.all([
      includeCin7 ? supabase.from("cin7_orders").select("status").gte("order_date", currentDate) : Promise.resolve({ data: [] }),
      includeCin7 ? supabase.from("cin7_orders").select("status").gte("order_date", previousDate).lt("order_date", currentDate) : Promise.resolve({ data: [] }),
      includeWoo ? supabase.from("woo_orders").select("status").gte("order_date", currentDate) : Promise.resolve({ data: [] }),
      includeWoo ? supabase.from("woo_orders").select("status").gte("order_date", previousDate).lt("order_date", currentDate) : Promise.resolve({ data: [] }),
    ]);

    // Initialize categories
    const categories = {
      new: { count: 0, prevCount: 0, label: "New Order" },
      in_progress: { count: 0, prevCount: 0, label: "In Progress" },
      completed: { count: 0, prevCount: 0, label: "Completed" },
      cancelled: { count: 0, prevCount: 0, label: "Cancelled" },
    };

    // Count Cin7 current
    (cin7Current.data || []).forEach((o) => {
      const cat = CIN7_STATUS_MAP[o.status] as keyof typeof categories;
      if (cat && categories[cat]) categories[cat].count++;
    });

    // Count Cin7 previous
    (cin7Previous.data || []).forEach((o) => {
      const cat = CIN7_STATUS_MAP[o.status] as keyof typeof categories;
      if (cat && categories[cat]) categories[cat].prevCount++;
    });

    // Count WooCommerce current
    (wooCurrent.data || []).forEach((o) => {
      const cat = WOO_STATUS_MAP[o.status] as keyof typeof categories;
      if (cat && categories[cat]) categories[cat].count++;
    });

    // Count WooCommerce previous
    (wooPrevious.data || []).forEach((o) => {
      const cat = WOO_STATUS_MAP[o.status] as keyof typeof categories;
      if (cat && categories[cat]) categories[cat].prevCount++;
    });

    // Calculate total and build response
    const total = Object.values(categories).reduce((sum, c) => sum + c.count, 0);

    const statusDistribution = Object.entries(categories).map(([key, data]) => {
      const change = data.prevCount > 0
        ? ((data.count - data.prevCount) / data.prevCount) * 100
        : data.count > 0 ? 100 : 0;

      return {
        id: key,
        label: data.label,
        count: data.count,
        percentage: total > 0 ? Math.round((data.count / total) * 1000) / 10 : 0,
        change: Math.round(change * 10) / 10,
      };
    });

    // Detailed status breakdown (combined)
    const detailedCounts: Record<string, { label: string; count: number }> = {};

    (cin7Current.data || []).forEach((o) => {
      const s = o.status || "UNKNOWN";
      if (!detailedCounts[s]) detailedCounts[s] = { label: s, count: 0 };
      detailedCounts[s].count++;
    });

    (wooCurrent.data || []).forEach((o) => {
      const s = `woo:${o.status || "unknown"}`;
      const label = o.status ? o.status.charAt(0).toUpperCase() + o.status.slice(1).replace("-", " ") : "Unknown";
      if (!detailedCounts[s]) detailedCounts[s] = { label: `${label} (Woo)`, count: 0 };
      detailedCounts[s].count++;
    });

    const detailedStatus = Object.entries(detailedCounts)
      .map(([status, data]) => ({
        status,
        label: data.label,
        count: data.count,
        percentage: total > 0 ? Math.round((data.count / total) * 1000) / 10 : 0,
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
