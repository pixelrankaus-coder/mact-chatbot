import { NextRequest, NextResponse } from "next/server";
import { listAllCustomers, listCustomers } from "@/lib/cin7";
import { getWooCustomers } from "@/lib/woocommerce";
import { mergeCustomers, getCustomerStats } from "@/lib/customer-merge";
import type { CustomerSource } from "@/types/customer";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const search = searchParams.get("search") || "";
  const source = searchParams.get("source") as CustomerSource | null;
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  try {
    // For search queries, use paginated approach for faster response
    // For full list, fetch all customers to enable proper merging and de-duplication
    const [cin7Result, wooResult] = await Promise.all([
      source !== "woocommerce"
        ? search
          ? listCustomers({ search, page, limit })
          : listAllCustomers({ maxPages: 15 }) // Fetch up to ~3750 customers
        : Promise.resolve({ CustomerList: [], Total: 0 }),
      source !== "cin7"
        ? getWooCustomers({
            search: search || undefined,
            page,
            per_page: search ? limit : 100, // Get more WooCommerce customers when not searching
          })
        : Promise.resolve({ customers: [], total: 0 }),
    ]);

    // Merge and de-duplicate
    const merged = mergeCustomers(
      cin7Result.CustomerList || [],
      wooResult.customers || []
    );

    // Get stats before filtering
    const stats = getCustomerStats(merged);

    // Apply source filter if specified
    let filtered = merged;
    if (source === "cin7") {
      filtered = merged.filter(
        (c) => c.sources.includes("cin7") && !c.sources.includes("woocommerce")
      );
    } else if (source === "woocommerce") {
      filtered = merged.filter(
        (c) => c.sources.includes("woocommerce") && !c.sources.includes("cin7")
      );
    } else if (source === "both") {
      filtered = merged.filter((c) => c.sources.length === 2);
    }

    // Sort by name
    filtered.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      customers: filtered,
      total: filtered.length,
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
