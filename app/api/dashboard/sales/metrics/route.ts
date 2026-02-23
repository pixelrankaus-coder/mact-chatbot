import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// Status categories for Cin7
const CIN7_COMPLETED = ["COMPLETED", "SHIPPED", "INVOICED", "CLOSED"];
const CIN7_PENDING = ["DRAFT", "ORDERING", "ORDERED", "APPROVED", "PICKING", "PACKED", "BACKORDERED", "ESTIMATING", "ESTIMATED", "INVOICING"];

// Status categories for WooCommerce
const WOO_COMPLETED = ["completed"];
const WOO_PENDING = ["processing", "on-hold", "pending"];

type OrderRow = { total: number | string | null; status: string };

/**
 * GET /api/dashboard/sales/metrics?source=all|cin7|woocommerce
 * Returns dashboard metrics combining Cin7 + WooCommerce data
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const source = req.nextUrl.searchParams.get("source") || "all";
    const includeCin7 = source === "all" || source === "cin7";
    const includeWoo = source === "all" || source === "woocommerce";

    // Get date ranges
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const currentDate = thirtyDaysAgo.toISOString().split("T")[0];
    const previousDate = sixtyDaysAgo.toISOString().split("T")[0];

    // Build parallel queries based on source
    const queries: Promise<{ data: OrderRow[] | null; error: unknown }>[] = [];

    if (includeCin7) {
      queries.push(
        supabase.from("cin7_orders").select("total, status").gte("order_date", currentDate),
        supabase.from("cin7_orders").select("total, status").gte("order_date", previousDate).lt("order_date", currentDate),
      );
    } else {
      queries.push(Promise.resolve({ data: [], error: null }), Promise.resolve({ data: [], error: null }));
    }

    if (includeWoo) {
      queries.push(
        supabase.from("woo_orders").select("total, status").gte("order_date", currentDate),
        supabase.from("woo_orders").select("total, status").gte("order_date", previousDate).lt("order_date", currentDate),
      );
    } else {
      queries.push(Promise.resolve({ data: [], error: null }), Promise.resolve({ data: [], error: null }));
    }

    const [cin7Current, cin7Previous, wooCurrent, wooPrevious] = await Promise.all(queries);

    const currentCin7 = cin7Current.data || [];
    const currentWoo = wooCurrent.data || [];
    const prevCin7 = cin7Previous.data || [];
    const prevWoo = wooPrevious.data || [];

    // Helper to sum totals
    const sumTotals = (orders: OrderRow[]) =>
      orders.reduce((sum, o) => sum + (parseFloat(String(o.total)) || 0), 0);

    // Current period revenue
    const currentRevenue = sumTotals(currentCin7) + sumTotals(currentWoo);
    const currentOrderCount = currentCin7.length + currentWoo.length;

    // Previous period revenue
    const previousRevenue = sumTotals(prevCin7) + sumTotals(prevWoo);
    const previousOrderCount = prevCin7.length + prevWoo.length;

    // Percentage changes
    const revenueChange = previousRevenue > 0
      ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
      : currentRevenue > 0 ? 100 : 0;
    const ordersChange = previousOrderCount > 0
      ? ((currentOrderCount - previousOrderCount) / previousOrderCount) * 100
      : currentOrderCount > 0 ? 100 : 0;

    // Completed revenue (income)
    const cin7Completed = currentCin7.filter(o => CIN7_COMPLETED.includes(o.status));
    const wooCompleted = currentWoo.filter(o => WOO_COMPLETED.includes(o.status));
    const income = sumTotals(cin7Completed) + sumTotals(wooCompleted);

    const prevCin7Completed = prevCin7.filter(o => CIN7_COMPLETED.includes(o.status));
    const prevWooCompleted = prevWoo.filter(o => WOO_COMPLETED.includes(o.status));
    const prevIncome = sumTotals(prevCin7Completed) + sumTotals(prevWooCompleted);
    const incomeChange = prevIncome > 0
      ? ((income - prevIncome) / prevIncome) * 100
      : income > 0 ? 100 : 0;

    // Outstanding/pending orders (balance)
    const cin7Pending = currentCin7.filter(o => CIN7_PENDING.includes(o.status));
    const wooPending = currentWoo.filter(o => WOO_PENDING.includes(o.status));
    const balance = sumTotals(cin7Pending) + sumTotals(wooPending);

    const prevCin7Pending = prevCin7.filter(o => CIN7_PENDING.includes(o.status));
    const prevWooPending = prevWoo.filter(o => WOO_PENDING.includes(o.status));
    const prevBalance = sumTotals(prevCin7Pending) + sumTotals(prevWooPending);
    const balanceChange = prevBalance > 0
      ? ((balance - prevBalance) / prevBalance) * 100
      : balance > 0 ? 100 : 0;

    // Estimate tax (10% GST) and expenses (15% placeholder)
    const tax = income * 0.1;
    const expenses = income * 0.15;

    // Get total counts based on source
    const countQueries = [];
    if (includeCin7) {
      countQueries.push(supabase.from("cin7_orders").select("*", { count: "exact", head: true }));
    } else {
      countQueries.push(Promise.resolve({ count: 0 }));
    }
    if (includeWoo) {
      countQueries.push(supabase.from("woo_orders").select("*", { count: "exact", head: true }));
    } else {
      countQueries.push(Promise.resolve({ count: 0 }));
    }
    countQueries.push(supabase.from("cin7_customers").select("*", { count: "exact", head: true }));

    const [cin7Count, wooCount, customerCount] = await Promise.all(countQueries);

    return NextResponse.json({
      revenue: {
        value: Math.round(currentRevenue * 100) / 100,
        change: Math.round(revenueChange * 10) / 10,
        period: "30d",
      },
      orders: {
        value: currentOrderCount,
        change: Math.round(ordersChange * 10) / 10,
        total: ((cin7Count as { count: number | null }).count || 0) + ((wooCount as { count: number | null }).count || 0),
      },
      customers: {
        total: (customerCount as { count: number | null }).count || 0,
      },
      balance: {
        value: Math.round(balance * 100) / 100,
        change: Math.round(balanceChange * 10) / 10,
        label: "Outstanding",
      },
      income: {
        value: Math.round(income * 100) / 100,
        change: Math.round(incomeChange * 10) / 10,
        label: "Completed Revenue",
      },
      expenses: {
        value: Math.round(expenses * 100) / 100,
        label: "Est. Expenses",
      },
      tax: {
        value: Math.round(tax * 100) / 100,
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
