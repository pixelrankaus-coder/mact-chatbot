import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

interface ProductRow {
  id: string;
  woo_id: number;
  name: string;
  sku: string;
  price: string;
  regular_price: string;
  sale_price: string;
  category: string;
  image_url: string | null;
  stock_quantity: number | null;
  stock_status: string;
  status: string;
  rating: string;
  total_sales: number;
}

/**
 * GET /api/products
 * Returns products from the woo_products table for the Products page
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const searchParams = req.nextUrl.searchParams;
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";
    const status = searchParams.get("status") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const perPage = parseInt(searchParams.get("per_page") || "100", 10);

    // Build query
    let query = supabase
      .from("woo_products")
      .select("*", { count: "exact" });

    if (search) {
      query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
    }
    if (category) {
      query = query.eq("category", category);
    }
    if (status) {
      query = query.eq("status", status);
    }

    // Pagination
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;
    query = query.range(from, to).order("name", { ascending: true });

    const { data: products, error, count } = await query;

    if (error) {
      console.error("Error fetching products:", error);
      // If table doesn't exist, return empty
      if (error.code === "42P01") {
        return NextResponse.json({
          products: [],
          stats: { totalSales: 0, numberOfSales: 0, totalProducts: 0, outOfStock: 0 },
          needsSync: true,
          message: "Run product sync first: POST /api/products/sync",
        });
      }
      throw error;
    }

    // Transform to match kit format
    const transformedProducts = ((products || []) as ProductRow[]).map((p, index) => {
      // Map stock_status to our status format
      let displayStatus: "active" | "out-of-stock" | "closed-for-sale" = "active";
      if (p.stock_status === "outofstock") {
        displayStatus = "out-of-stock";
      } else if (p.status !== "publish") {
        displayStatus = "closed-for-sale";
      }

      return {
        id: index + 1,
        name: p.name,
        image: p.image_url || null,
        description: "",
        category: p.category || "Other",
        sku: p.sku || "",
        stock: p.stock_quantity !== null ? String(p.stock_quantity) : "N/A",
        price: p.price ? `$${parseFloat(p.price).toFixed(2)}` : "$0.00",
        rating: p.rating || "0",
        status: displayStatus,
      };
    });

    // Calculate stats
    const totalProducts = count || 0;
    const outOfStock = (products || []).filter(
      (p: ProductRow) => p.stock_status === "outofstock"
    ).length;
    const totalSales = (products || []).reduce(
      (sum: number, p: ProductRow) => sum + (p.total_sales || 0),
      0
    );

    return NextResponse.json({
      products: transformedProducts,
      stats: {
        totalSales: totalSales * 100, // Approximate revenue
        numberOfSales: totalSales,
        totalProducts,
        outOfStock,
      },
      total: totalProducts,
      page,
      perPage,
      needsSync: !products || products.length === 0,
    });
  } catch (error) {
    console.error("Products API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}
