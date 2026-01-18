import { NextRequest, NextResponse } from "next/server";
import { searchSales } from "@/lib/cin7";
import { listWooOrders } from "@/lib/woocommerce";
import { mergeOrders, getOrderStats } from "@/lib/order-merge";
import { OrderSource } from "@/types/order";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const search = searchParams.get("search") || "";
  const source = searchParams.get("source") as OrderSource | null;
  const status = searchParams.get("status") || "";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "25", 10);

  try {
    // Fetch from both sources in parallel
    const [cin7Result, wooResult] = await Promise.all([
      source !== "woocommerce"
        ? searchSales({
            search: search || undefined,
            status: status || undefined,
            page,
            limit,
          })
        : Promise.resolve({ SaleList: [], Total: 0 }),
      source !== "cin7"
        ? listWooOrders({
            search: search || undefined,
            status: status || undefined,
            page,
            per_page: limit,
          })
        : Promise.resolve({ orders: [], total: 0 }),
    ]);

    // Merge orders from both sources
    const merged = mergeOrders(
      cin7Result.SaleList || [],
      wooResult.orders || []
    );

    // Get stats
    const stats = getOrderStats(merged);

    // Apply source filter if specified
    let filtered = merged;
    if (source === "cin7") {
      filtered = merged.filter((o) => o.source === "cin7");
    } else if (source === "woocommerce") {
      filtered = merged.filter((o) => o.source === "woocommerce");
    }

    return NextResponse.json({
      orders: filtered,
      total: filtered.length,
      stats,
    });
  } catch (error) {
    console.error("Unified orders API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}
