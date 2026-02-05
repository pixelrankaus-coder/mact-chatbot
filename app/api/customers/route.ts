import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import type { CustomerSource, UnifiedCustomer } from "@/types/customer";

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

    // Fetch Cin7 customers from Supabase cache with order aggregates
    let cin7Customers: UnifiedCustomer[] = [];
    let cin7Total = 0;

    if (source !== "woocommerce") {
      // Fetch ALL Cin7 customers with pagination to get around Supabase's 1000 row default limit
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let cin7Data: any[] = [];
      let customersPage = 0;
      const customersPageSize = 1000;
      let hasMoreCustomers = true;

      while (hasMoreCustomers) {
        let query = supabase
          .from("cin7_customers")
          .select("*", { count: "exact" })
          .range(customersPage * customersPageSize, (customersPage + 1) * customersPageSize - 1);

        // Apply search filter
        if (search) {
          query = query.or(
            `name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`
          );
        }

        const { data: customersChunk, count, error } = await query;

        if (error) {
          console.error("Supabase cin7_customers query error:", error);
          hasMoreCustomers = false;
        } else if (customersChunk && customersChunk.length > 0) {
          cin7Data = cin7Data.concat(customersChunk);
          // Use count from first page to set total
          if (customersPage === 0) {
            cin7Total = count || 0;
          }
          customersPage++;
          hasMoreCustomers = customersChunk.length === customersPageSize;
        } else {
          hasMoreCustomers = false;
        }
      }

      if (cin7Data.length > 0) {

        // Fetch ALL orders for Cin7 customers to calculate aggregates
        // Use pagination to get around Supabase's 1000 row default limit
        let cin7Orders: { customer_id: string; total: number; order_date: string }[] = [];
        let ordersPage = 0;
        const ordersPageSize = 1000;
        let hasMoreOrders = true;

        while (hasMoreOrders) {
          const { data: ordersChunk } = await supabase
            .from("cin7_orders")
            .select("customer_id, total, order_date")
            .range(ordersPage * ordersPageSize, (ordersPage + 1) * ordersPageSize - 1);

          if (ordersChunk && ordersChunk.length > 0) {
            cin7Orders = cin7Orders.concat(ordersChunk);
            ordersPage++;
            hasMoreOrders = ordersChunk.length === ordersPageSize;
          } else {
            hasMoreOrders = false;
          }
        }

        // Build order aggregates by customer_id
        const orderAggregates: Record<string, { count: number; total: number; lastDate: string | null }> = {};
        (cin7Orders || []).forEach((o: { customer_id: string; total: number; order_date: string }) => {
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
        cin7Customers = (cin7Data || []).map((c: any) => {
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
    }

    // Fetch WooCommerce customers from Supabase cache (includes guest checkout customers)
    let wooCustomers: UnifiedCustomer[] = [];
    let wooTotal = 0;

    if (source !== "cin7") {
      // Fetch ALL WooCommerce customers with pagination to get around Supabase's 1000 row default limit
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let wooData: any[] = [];
      let wooCustomersPage = 0;
      const wooCustomersPageSize = 1000;
      let hasMoreWooCustomers = true;

      while (hasMoreWooCustomers) {
        let wooQuery = supabase
          .from("woo_customers")
          .select("*", { count: "exact" })
          .range(wooCustomersPage * wooCustomersPageSize, (wooCustomersPage + 1) * wooCustomersPageSize - 1);

        // Apply search filter
        if (search) {
          wooQuery = wooQuery.or(
            `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`
          );
        }

        const { data: wooCustomersChunk, count: wooCount, error: wooError } = await wooQuery;

        if (wooError) {
          console.error("Supabase woo_customers query error:", wooError);
          hasMoreWooCustomers = false;
        } else if (wooCustomersChunk && wooCustomersChunk.length > 0) {
          wooData = wooData.concat(wooCustomersChunk);
          // Use count from first page to set total
          if (wooCustomersPage === 0) {
            wooTotal = wooCount || 0;
          }
          wooCustomersPage++;
          hasMoreWooCustomers = wooCustomersChunk.length === wooCustomersPageSize;
        } else {
          hasMoreWooCustomers = false;
        }
      }

      if (wooData.length > 0) {

        // Fetch ALL orders for WooCommerce customers to calculate aggregates
        // Use pagination to get around Supabase's 1000 row default limit
        let wooOrders: { customer_email: string; total: number; order_date: string }[] = [];
        let wooOrdersPage = 0;
        const wooOrdersPageSize = 1000;
        let hasMoreWooOrders = true;

        while (hasMoreWooOrders) {
          const { data: wooOrdersChunk } = await supabase
            .from("woo_orders")
            .select("customer_email, total, order_date")
            .range(wooOrdersPage * wooOrdersPageSize, (wooOrdersPage + 1) * wooOrdersPageSize - 1);

          if (wooOrdersChunk && wooOrdersChunk.length > 0) {
            wooOrders = wooOrders.concat(wooOrdersChunk);
            wooOrdersPage++;
            hasMoreWooOrders = wooOrdersChunk.length === wooOrdersPageSize;
          } else {
            hasMoreWooOrders = false;
          }
        }

        // Build order aggregates by customer email
        const wooOrderAggregates: Record<string, { count: number; total: number; lastDate: string | null }> = {};
        (wooOrders || []).forEach((o: { customer_email: string; total: number; order_date: string }) => {
          const email = o.customer_email?.toLowerCase();
          if (!email) return;
          if (!wooOrderAggregates[email]) {
            wooOrderAggregates[email] = { count: 0, total: 0, lastDate: null };
          }
          wooOrderAggregates[email].count += 1;
          wooOrderAggregates[email].total += parseFloat(String(o.total)) || 0;
          if (!wooOrderAggregates[email].lastDate || o.order_date > wooOrderAggregates[email].lastDate) {
            wooOrderAggregates[email].lastDate = o.order_date;
          }
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        wooCustomers = (wooData || []).map((c: any) => {
          const email = c.email?.toLowerCase();
          const fallbackTotal = parseFloat(String(c.total_spent)) || 0;
          const agg = email ? wooOrderAggregates[email] || { count: 0, total: 0, lastDate: null } : { count: c.orders_count || 0, total: fallbackTotal, lastDate: null };
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
            totalOrders: agg.count || parseInt(String(c.orders_count)) || 0,
            totalSpent: agg.total || fallbackTotal,
            lastOrderDate: agg.lastDate,
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
