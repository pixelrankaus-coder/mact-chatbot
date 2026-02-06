import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

interface LineItem {
  Name?: string;
  name?: string;
  SKU?: string;
  sku?: string;
  Quantity?: number;
  quantity?: number;
  Total?: number;
  total?: number;
  Price?: number;
  price?: number;
}

/**
 * GET /api/dashboard/sales/products
 * Returns top selling products for the dashboard
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const limit = parseInt(searchParams.get("limit") || "6", 10);
  const period = searchParams.get("period") || "30d";

  try {
    const supabase = createServiceClient();

    // Calculate date range
    const now = new Date();
    const daysBack = parseInt(period.replace("d", ""), 10) || 30;
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - daysBack);

    // Fetch orders with line items
    const { data: orders, error } = await supabase
      .from("cin7_orders")
      .select("line_items, total")
      .gte("order_date", startDate.toISOString().split("T")[0]);

    if (error) {
      console.error("Error fetching orders for products:", error);
      throw error;
    }

    // Aggregate product sales
    const productSales: Record<string, {
      name: string;
      sku: string;
      quantity: number;
      revenue: number;
    }> = {};

    (orders || []).forEach((order) => {
      const lineItems = order.line_items as LineItem[] | null;
      if (!Array.isArray(lineItems)) return;

      lineItems.forEach((item) => {
        const name = item.Name || item.name || "Unknown Product";
        const sku = item.SKU || item.sku || "N/A";
        const quantity = item.Quantity || item.quantity || 1;
        const total = item.Total || item.total || item.Price || item.price || 0;

        const key = sku !== "N/A" ? sku : name;

        if (!productSales[key]) {
          productSales[key] = {
            name,
            sku,
            quantity: 0,
            revenue: 0,
          };
        }

        productSales[key].quantity += quantity;
        productSales[key].revenue += parseFloat(String(total)) || 0;
      });
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

    // Calculate total units and revenue for context
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
    });
  } catch (error) {
    console.error("Top products error:", error);
    return NextResponse.json(
      { error: "Failed to fetch top products" },
      { status: 500 }
    );
  }
}
