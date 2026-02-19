import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import type { CustomerSource, UnifiedCustomer } from "@/types/customer";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any;

// Segment filter type
type Segment = "all" | "vip" | "active" | "dormant" | "new" | "marketable";

// Default segment settings
const DEFAULT_SEGMENT_SETTINGS = {
  vip_min_orders: 5,
  vip_min_spend: 5000,
  dormant_months: 12,
  active_min_orders: 2,
  active_months: 6,
  new_days: 30,
};

// Helper: fetch all rows from a Supabase table with pagination
async function fetchAllPaginated(
  supabase: SupabaseAny,
  table: string,
  select: string,
  applyFilters?: (query: SupabaseAny) => SupabaseAny,
  pageSize = 1000
): Promise<{ data: SupabaseAny[]; total: number }> {
  let allData: SupabaseAny[] = [];
  let page = 0;
  let total = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from(table)
      .select(select, { count: "exact" })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (applyFilters) query = applyFilters(query);

    const { data: chunk, count, error } = await query;

    if (error) {
      console.error(`Supabase ${table} query error:`, error);
      hasMore = false;
    } else if (chunk && chunk.length > 0) {
      allData = allData.concat(chunk);
      if (page === 0) total = count || 0;
      page++;
      hasMore = chunk.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  return { data: allData, total: total || allData.length };
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const search = searchParams.get("search") || "";
  const source = searchParams.get("source") as CustomerSource | null;
  const segment = (searchParams.get("segment") || "all") as Segment;
  const sortBy = searchParams.get("sortBy") || "total_spent";
  const sortDir = searchParams.get("sortDir") || "desc";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  try {
    const supabase = createServiceClient() as SupabaseAny;

    // Fetch customer segment settings
    let segmentSettings = DEFAULT_SEGMENT_SETTINGS;
    const { data: settingsData } = await supabase
      .from("customer_segment_settings")
      .select("*")
      .limit(1)
      .single();

    if (settingsData) {
      segmentSettings = { ...DEFAULT_SEGMENT_SETTINGS, ...settingsData };
    }

    // Run all data fetches in PARALLEL for speed
    // - cin7_customers + cin7_orders + woo_customers fetched simultaneously
    // - woo_orders is SKIPPED entirely (woo_customers already has orders_count & total_spent)
    const searchFilter = search
      ? {
          cin7: (q: SupabaseAny) => q.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`),
          woo: (q: SupabaseAny) => q.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`),
        }
      : { cin7: undefined, woo: undefined };

    const needCin7 = source !== "woocommerce";
    const needWoo = source !== "cin7";

    const [cin7CustomersResult, cin7OrdersResult, wooCustomersResult] = await Promise.all([
      needCin7
        ? fetchAllPaginated(supabase, "cin7_customers", "*", searchFilter.cin7)
        : { data: [], total: 0 },
      needCin7
        ? fetchAllPaginated(supabase, "cin7_orders", "customer_id, total, order_date")
        : { data: [], total: 0 },
      needWoo
        ? fetchAllPaginated(supabase, "woo_customers", "*", searchFilter.woo)
        : { data: [], total: 0 },
    ]);

    const cin7Total = cin7CustomersResult.total;
    const wooTotal = wooCustomersResult.total;

    // Build Cin7 customers with order aggregates
    let cin7Customers: UnifiedCustomer[] = [];
    if (cin7CustomersResult.data.length > 0) {
      const orderAggregates: Record<string, { count: number; total: number; lastDate: string | null }> = {};
      cin7OrdersResult.data.forEach((o: { customer_id: string; total: number; order_date: string }) => {
        const cid = o.customer_id;
        if (!orderAggregates[cid]) {
          orderAggregates[cid] = { count: 0, total: 0, lastDate: null };
        }
        orderAggregates[cid].count += 1;
        orderAggregates[cid].total += parseFloat(String(o.total)) || 0;
        if (!orderAggregates[cid].lastDate || o.order_date > orderAggregates[cid].lastDate) {
          orderAggregates[cid].lastDate = o.order_date;
        }
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cin7Customers = cin7CustomersResult.data.map((c: any) => {
        const agg = orderAggregates[c.cin7_id] || { count: 0, total: 0, lastDate: null };
        return {
          id: `cin7-${c.cin7_id}`,
          cin7Id: c.cin7_id,
          name: c.name || "",
          email: c.email || "",
          phone: c.phone || "",
          company: c.company || c.name || "",
          status: c.status?.toLowerCase() === "active" ? "active" : "inactive",
          sources: ["cin7"] as ("cin7" | "woocommerce")[],
          lastUpdated: c.updated_at || "",
          totalOrders: agg.count,
          totalSpent: agg.total,
          lastOrderDate: agg.lastDate,
          cin7Data: {
            currency: c.currency,
            paymentTerm: c.payment_term,
            creditLimit: c.credit_limit ? parseFloat(String(c.credit_limit)) : undefined,
            discount: c.discount ? parseFloat(String(c.discount)) : undefined,
            taxNumber: c.tax_number,
            tags: c.tags,
          },
        };
      });
    }

    // Build WooCommerce customers using pre-computed aggregate columns
    // (orders_count and total_spent already exist on woo_customers - no need to fetch woo_orders)
    let wooCustomers: UnifiedCustomer[] = [];
    if (wooCustomersResult.data.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      wooCustomers = wooCustomersResult.data.map((c: any) => {
        return {
          id: `woo-${c.woo_id}`,
          wooId: c.woo_id,
          name: `${c.first_name || ""} ${c.last_name || ""}`.trim() || c.email || "Guest",
          email: c.email || "",
          phone: c.phone || "",
          company: c.company || "",
          status: "active" as const,
          sources: ["woocommerce"] as ("cin7" | "woocommerce")[],
          lastUpdated: c.updated_at || "",
          totalOrders: parseInt(String(c.orders_count)) || 0,
          totalSpent: parseFloat(String(c.total_spent)) || 0,
          lastOrderDate: c.date_created || null,
          wooData: {
            username: c.username,
            ordersCount: c.orders_count,
            totalSpent: c.total_spent,
            avatarUrl: c.avatar_url,
            billingAddress: c.billing_address,
            shippingAddress: c.shipping_address,
          },
        };
      });
    }

    // Combine both lists
    let allCustomers = [...cin7Customers, ...wooCustomers];

    // Apply segment filter using configurable settings
    const now = new Date();
    const newDaysAgo = new Date(now.getTime() - segmentSettings.new_days * 24 * 60 * 60 * 1000);
    const activeMonthsAgo = new Date(now.getTime() - segmentSettings.active_months * 30 * 24 * 60 * 60 * 1000);
    const dormantMonthsAgo = new Date(now.getTime() - segmentSettings.dormant_months * 30 * 24 * 60 * 60 * 1000);

    if (segment !== "all") {
      allCustomers = allCustomers.filter((c) => {
        const lastOrder = c.lastOrderDate ? new Date(c.lastOrderDate) : null;
        const orders = c.totalOrders || 0;
        const spent = c.totalSpent || 0;

        switch (segment) {
          case "vip":
            // Configurable: X+ orders OR $Y+ total spend
            return orders >= segmentSettings.vip_min_orders || spent >= segmentSettings.vip_min_spend;
          case "active":
            // Configurable: X+ orders in last Y months
            return orders >= segmentSettings.active_min_orders && lastOrder && lastOrder > activeMonthsAgo;
          case "dormant":
            // Configurable: Has ordered before, nothing in X months
            return orders > 0 && lastOrder && lastOrder < dormantMonthsAgo;
          case "new":
            // Configurable: First order in last X days
            return orders === 1 && lastOrder && lastOrder > newDaysAgo;
          case "marketable":
            // Has email address
            return c.email && c.email.trim() !== "";
          default:
            return true;
        }
      });
    }

    // Calculate segment counts for stats (before pagination)
    const segmentCounts = {
      all: cin7Total + wooTotal,
      vip: 0,
      active: 0,
      dormant: 0,
      new: 0,
      marketable: 0,
    };

    // Recount from combined list for accurate stats using configurable settings
    const allForStats = [...cin7Customers, ...wooCustomers];
    allForStats.forEach((c) => {
      const lastOrder = c.lastOrderDate ? new Date(c.lastOrderDate) : null;
      const orders = c.totalOrders || 0;
      const spent = c.totalSpent || 0;

      if (orders >= segmentSettings.vip_min_orders || spent >= segmentSettings.vip_min_spend) segmentCounts.vip++;
      if (orders >= segmentSettings.active_min_orders && lastOrder && lastOrder > activeMonthsAgo) segmentCounts.active++;
      if (orders > 0 && lastOrder && lastOrder < dormantMonthsAgo) segmentCounts.dormant++;
      if (orders === 1 && lastOrder && lastOrder > newDaysAgo) segmentCounts.new++;
      if (c.email && c.email.trim() !== "") segmentCounts.marketable++;
    });

    // Build stats
    const stats = {
      cin7Only: cin7Total,
      wooOnly: wooTotal,
      both: 0, // Would need full data to calculate overlaps
      total: cin7Total + wooTotal,
      segments: segmentCounts,
    };

    // Apply source filter
    if (source === "cin7") {
      allCustomers = allCustomers.filter((c) => c.sources.includes("cin7"));
    } else if (source === "woocommerce") {
      allCustomers = allCustomers.filter((c) => c.sources.includes("woocommerce"));
    }

    // Apply sorting
    allCustomers.sort((a, b) => {
      let aVal: string | number = 0;
      let bVal: string | number = 0;

      switch (sortBy) {
        case "total_spent":
          // Ensure numeric comparison - parseFloat handles strings safely
          aVal = parseFloat(String(a.totalSpent)) || 0;
          bVal = parseFloat(String(b.totalSpent)) || 0;
          break;
        case "total_orders":
          aVal = parseInt(String(a.totalOrders)) || 0;
          bVal = parseInt(String(b.totalOrders)) || 0;
          break;
        case "last_order_date":
          aVal = a.lastOrderDate || "";
          bVal = b.lastOrderDate || "";
          break;
        case "name":
        default:
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }

      return sortDir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

    // Calculate total before pagination
    const totalFiltered = allCustomers.length;

    // Apply pagination
    const offset = (page - 1) * limit;
    const paginatedCustomers = allCustomers.slice(offset, offset + limit);

    return NextResponse.json({
      customers: paginatedCustomers,
      total: totalFiltered,
      page,
      limit,
      stats,
    });
  } catch (error) {
    console.error("Unified customers API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch customers" },
      { status: 500 }
    );
  }
}
