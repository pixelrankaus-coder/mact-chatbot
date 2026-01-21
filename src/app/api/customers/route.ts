import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import type { CustomerSource, UnifiedCustomer } from "@/types/customer";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any;

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const search = searchParams.get("search") || "";
  const source = searchParams.get("source") as CustomerSource | null;
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const offset = (page - 1) * limit;

  try {
    const supabase = createServiceClient() as SupabaseAny;

    // Fetch Cin7 customers from Supabase cache
    let cin7Customers: UnifiedCustomer[] = [];
    let cin7Total = 0;

    if (source !== "woocommerce") {
      let query = supabase
        .from("cin7_customers")
        .select("*", { count: "exact" })
        .order("name", { ascending: true });

      // Apply search filter
      if (search) {
        query = query.or(
          `name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`
        );
      }

      // Pagination
      query = query.range(offset, offset + limit - 1);

      const { data: cin7Data, count, error } = await query;

      if (error) {
        console.error("Supabase cin7_customers query error:", error);
      } else {
        cin7Total = count || 0;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cin7Customers = (cin7Data || []).map((c: any) => ({
          id: `cin7-${c.cin7_id}`,
          cin7Id: c.cin7_id,
          name: c.name || "",
          email: c.email || "",
          phone: c.phone || "",
          company: c.company || c.name || "",
          status: c.status?.toLowerCase() === "active" ? "active" : "inactive",
          sources: ["cin7"] as ("cin7" | "woocommerce")[],
          lastUpdated: c.updated_at || "",
          cin7Data: {
            currency: c.currency,
            paymentTerm: c.payment_term,
            creditLimit: c.credit_limit ? parseFloat(String(c.credit_limit)) : undefined,
            discount: c.discount ? parseFloat(String(c.discount)) : undefined,
            taxNumber: c.tax_number,
            tags: c.tags,
          },
        }));
      }
    }

    // Fetch WooCommerce customers from Supabase cache (includes guest checkout customers)
    let wooCustomers: UnifiedCustomer[] = [];
    let wooTotal = 0;

    if (source !== "cin7") {
      let wooQuery = supabase
        .from("woo_customers")
        .select("*", { count: "exact" })
        .order("first_name", { ascending: true });

      // Apply search filter
      if (search) {
        wooQuery = wooQuery.or(
          `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`
        );
      }

      // Pagination
      wooQuery = wooQuery.range(offset, offset + limit - 1);

      const { data: wooData, count: wooCount, error: wooError } = await wooQuery;

      if (wooError) {
        console.error("Supabase woo_customers query error:", wooError);
      } else {
        wooTotal = wooCount || 0;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        wooCustomers = (wooData || []).map((c: any) => ({
          id: `woo-${c.woo_id}`,
          wooId: c.woo_id,
          name: `${c.first_name || ""} ${c.last_name || ""}`.trim() || c.email || "Guest",
          email: c.email || "",
          phone: c.phone || "",
          company: c.company || "",
          status: "active" as const,
          sources: ["woocommerce"] as ("cin7" | "woocommerce")[],
          lastUpdated: c.updated_at || "",
          wooData: {
            username: c.username,
            ordersCount: c.orders_count,
            totalSpent: c.total_spent,
            avatarUrl: c.avatar_url,
            billingAddress: c.billing_address,
            shippingAddress: c.shipping_address,
          },
        }));
      }
    }

    // Combine both lists
    const allCustomers = [...cin7Customers, ...wooCustomers];

    // Build stats
    const stats = {
      cin7Only: cin7Total,
      wooOnly: wooTotal,
      both: 0, // Would need full data to calculate overlaps
      total: cin7Total + wooTotal,
    };

    // Apply source filter
    let filtered = allCustomers;
    if (source === "cin7") {
      filtered = cin7Customers;
    } else if (source === "woocommerce") {
      filtered = wooCustomers;
    }

    // Sort by name
    filtered.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      customers: filtered,
      total: filtered.length,
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
