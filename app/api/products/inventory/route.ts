import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

/**
 * GET /api/products/inventory
 * Returns Cin7 products with aggregated stock levels
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const searchParams = req.nextUrl.searchParams;
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";
    const status = searchParams.get("status") || "";
    const type = searchParams.get("type") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const perPage = parseInt(searchParams.get("per_page") || "100", 10);

    // Build query for cin7_products
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from("cin7_products")
      .select("*", { count: "exact" });

    if (search) {
      query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
    }
    if (category) {
      query = query.eq("category", category);
    }
    if (status) {
      query = query.eq("cin7_status", status);
    }
    if (type) {
      query = query.eq("type", type);
    }

    // Only show sellable products by default
    if (!searchParams.has("all")) {
      query = query.eq("sellable", true);
    }

    const from = (page - 1) * perPage;
    const to = from + perPage - 1;
    query = query.range(from, to).order("name", { ascending: true });

    const { data: products, error, count } = await query;

    if (error) {
      // If table doesn't have new columns yet, return empty with migration hint
      console.error("Inventory query error:", error);
      return NextResponse.json({
        products: [],
        stats: { total: 0, inStock: 0, outOfStock: 0, lowStock: 0 },
        needsMigration: true,
        message: "Run the cin7_inventory migration first",
      });
    }

    // Get stock data for these products
    const cin7Ids = (products || [])
      .map((p: Record<string, unknown>) => p.cin7_id)
      .filter(Boolean);

    let stockMap: Record<string, { total_on_hand: number; total_available: number; total_on_order: number; locations: Record<string, unknown>[] }> = {};

    if (cin7Ids.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: stockData } = await (supabase as any)
        .from("cin7_product_stock")
        .select("cin7_product_id, location, on_hand, available, allocated, on_order, in_transit")
        .in("cin7_product_id", cin7Ids);

      if (stockData) {
        for (const s of stockData as Record<string, unknown>[]) {
          const pid = s.cin7_product_id as string;
          if (!stockMap[pid]) {
            stockMap[pid] = { total_on_hand: 0, total_available: 0, total_on_order: 0, locations: [] };
          }
          stockMap[pid].total_on_hand += (s.on_hand as number) || 0;
          stockMap[pid].total_available += (s.available as number) || 0;
          stockMap[pid].total_on_order += (s.on_order as number) || 0;
          stockMap[pid].locations.push(s);
        }
      }
    }

    // Combine products with stock
    const enrichedProducts = (products || []).map((p: Record<string, unknown>) => {
      const stock = stockMap[p.cin7_id as string];
      return {
        ...p,
        stock_on_hand: stock?.total_on_hand ?? 0,
        stock_available: stock?.total_available ?? 0,
        stock_on_order: stock?.total_on_order ?? 0,
        stock_locations: stock?.locations ?? [],
      };
    });

    // Stats
    const total = count || 0;
    const inStock = enrichedProducts.filter((p: Record<string, unknown>) => (p.stock_available as number) > 0).length;
    const outOfStock = enrichedProducts.filter(
      (p: Record<string, unknown>) => (p.stock_available as number) === 0 && p.type === "Stock"
    ).length;
    const lowStock = enrichedProducts.filter((p: Record<string, unknown>) => {
      const avail = p.stock_available as number;
      const reorder = (p.min_before_reorder as number) || 0;
      return avail > 0 && reorder > 0 && avail <= reorder;
    }).length;

    return NextResponse.json({
      products: enrichedProducts,
      stats: { total, inStock, outOfStock, lowStock },
      page,
      perPage,
    });
  } catch (error) {
    console.error("Inventory API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch inventory" },
      { status: 500 }
    );
  }
}
