import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

interface OrderItem {
  sku: string;
  product_name: string;
  quantity: number;
  total_price: number;
}

// Product category mappings based on SKU/name patterns
const CATEGORY_PATTERNS: Record<string, RegExp[]> = {
  "gfrc-premix": [/premix/i, /gfrc.*mix/i, /scc.*silica/i],
  "additives": [/additive/i, /polymer/i, /fiber/i, /admix/i],
  "tools": [/tool/i, /mixer/i, /mould/i, /mold/i, /spray/i],
  "equipment": [/equipment/i, /machine/i, /pump/i],
};

function getProductCategory(name: string, sku: string): string {
  const text = `${name} ${sku}`.toLowerCase();
  for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
    if (patterns.some((p) => p.test(text))) {
      return category;
    }
  }
  return "other";
}

/**
 * GET /api/dashboard/sales/products
 * Returns top selling products from cin7_order_items table
 *
 * Query params:
 * - limit: Number of products to return (default: 6)
 * - period: Time period - 30d, 90d, 180d, 365d (default: 90d)
 * - category: Filter by category - all, gfrc-premix, additives, tools, equipment (default: all)
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const limit = parseInt(searchParams.get("limit") || "6", 10);
  const period = searchParams.get("period") || "90d";
  const category = searchParams.get("category") || "all";

  try {
    const supabase = createServiceClient();

    // Calculate date ranges for current and previous periods
    const now = new Date();
    const daysBack = parseInt(period.replace("d", ""), 10) || 90;
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - daysBack);

    const prevStartDate = new Date(startDate);
    prevStartDate.setDate(prevStartDate.getDate() - daysBack);

    // Fetch current period items
    const { data: items, error } = await supabase
      .from("cin7_order_items")
      .select("sku, product_name, quantity, total_price")
      .gte("order_date", startDate.toISOString().split("T")[0]);

    // Fetch previous period items for trend comparison
    const { data: prevItems } = await supabase
      .from("cin7_order_items")
      .select("sku, product_name, quantity, total_price")
      .gte("order_date", prevStartDate.toISOString().split("T")[0])
      .lt("order_date", startDate.toISOString().split("T")[0]);

    if (error) {
      console.error("Error fetching product items:", error);
      // If table doesn't exist yet, return empty
      if (error.code === "42P01") {
        return NextResponse.json({
          products: [],
          summary: { totalProducts: 0, totalUnitsSold: 0, totalRevenue: 0 },
          period,
          category,
          needsSync: true,
          message: "Run product sync first: POST /api/dashboard/sales/products/sync",
        });
      }
      throw error;
    }

    // Aggregate current period by SKU
    const productSales: Record<string, {
      name: string;
      sku: string;
      category: string;
      quantity: number;
      revenue: number;
    }> = {};

    ((items || []) as OrderItem[]).forEach((item) => {
      const key = item.sku || item.product_name;
      const itemCategory = getProductCategory(item.product_name || "", item.sku || "");

      // Filter by category if specified
      if (category !== "all" && itemCategory !== category) {
        return;
      }

      if (!productSales[key]) {
        productSales[key] = {
          name: item.product_name,
          sku: item.sku,
          category: itemCategory,
          quantity: 0,
          revenue: 0,
        };
      }

      productSales[key].quantity += item.quantity || 0;
      productSales[key].revenue += parseFloat(String(item.total_price)) || 0;
    });

    // Aggregate previous period by SKU for trends
    const prevProductSales: Record<string, { quantity: number; revenue: number }> = {};
    ((prevItems || []) as OrderItem[]).forEach((item) => {
      const key = item.sku || item.product_name;
      const itemCategory = getProductCategory(item.product_name || "", item.sku || "");

      if (category !== "all" && itemCategory !== category) {
        return;
      }

      if (!prevProductSales[key]) {
        prevProductSales[key] = { quantity: 0, revenue: 0 };
      }
      prevProductSales[key].quantity += item.quantity || 0;
      prevProductSales[key].revenue += parseFloat(String(item.total_price)) || 0;
    });

    // Sort by quantity sold and take top N, include trend data
    const topProducts = Object.values(productSales)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, limit)
      .map((product, index) => {
        const prev = prevProductSales[product.sku] || { quantity: 0, revenue: 0 };
        const quantityChange = prev.quantity > 0
          ? Math.round(((product.quantity - prev.quantity) / prev.quantity) * 100)
          : product.quantity > 0 ? 100 : 0;

        return {
          rank: index + 1,
          name: product.name,
          sku: product.sku,
          category: product.category,
          unitsSold: product.quantity,
          revenue: Math.round(product.revenue * 100) / 100,
          trend: quantityChange,
        };
      });

    // Calculate totals
    const totalUnits = Object.values(productSales).reduce(
      (sum, p) => sum + p.quantity,
      0
    );
    const totalRevenue = Object.values(productSales).reduce(
      (sum, p) => sum + p.revenue,
      0
    );

    // Get available categories from data
    const allCategories = new Set<string>();
    ((items || []) as OrderItem[]).forEach((item) => {
      allCategories.add(getProductCategory(item.product_name || "", item.sku || ""));
    });

    return NextResponse.json({
      products: topProducts,
      summary: {
        totalProducts: Object.keys(productSales).length,
        totalUnitsSold: totalUnits,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
      },
      period,
      category,
      availableCategories: Array.from(allCategories),
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
