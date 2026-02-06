import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

/**
 * GET /api/dashboard/sales/products
 * Returns top selling products from cin7_order_items table
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const limit = parseInt(searchParams.get("limit") || "6", 10);
  const period = searchParams.get("period") || "90d";

  try {
    const supabase = createServiceClient();

    // Calculate date range
    const now = new Date();
    const daysBack = parseInt(period.replace("d", ""), 10) || 90;
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - daysBack);

    // Fetch aggregated product sales from cin7_order_items
    const { data: items, error } = await supabase
      .from("cin7_order_items")
      .select("sku, product_name, quantity, total_price")
      .gte("order_date", startDate.toISOString().split("T")[0]);

    if (error) {
      console.error("Error fetching product items:", error);
      // If table doesn't exist yet, return empty
      if (error.code === "42P01") {
        return NextResponse.json({
          products: [],
          summary: { totalProducts: 0, totalUnitsSold: 0, totalRevenue: 0 },
          period,
          needsSync: true,
          message: "Run product sync first: POST /api/dashboard/sales/products/sync",
        });
      }
      throw error;
    }

    // Aggregate by SKU
    const productSales: Record<string, {
      name: string;
      sku: string;
      quantity: number;
      revenue: number;
    }> = {};

    (items || []).forEach((item) => {
      const key = item.sku || item.product_name;

      if (!productSales[key]) {
        productSales[key] = {
          name: item.product_name,
          sku: item.sku,
          quantity: 0,
          revenue: 0,
        };
      }

      productSales[key].quantity += item.quantity || 0;
      productSales[key].revenue += parseFloat(String(item.total_price)) || 0;
    });

    // Sort by quantity sold and take top N
    const topProducts = Object.values(productSales)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, limit)
      .map((product, index) => ({
        rank: index + 1,
        name: product.name,
        sku: product.sku,
        unitsSold: product.quantity,
        revenue: Math.round(product.revenue * 100) / 100,
      }));

    // Calculate totals
    const totalUnits = Object.values(productSales).reduce(
      (sum, p) => sum + p.quantity,
      0
    );
    const totalRevenue = Object.values(productSales).reduce(
      (sum, p) => sum + p.revenue,
      0
    );

    return NextResponse.json({
      products: topProducts,
      summary: {
        totalProducts: Object.keys(productSales).length,
        totalUnitsSold: totalUnits,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
      },
      period,
      needsSync: items?.length === 0,
    });
  } catch (error) {
    console.error("Top products error:", error);
    return NextResponse.json(
      { error: "Failed to fetch top products" },
      { status: 500 }
    );
  }
}
