import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { getAllWooProducts, WooProduct } from "@/lib/woocommerce";

/**
 * POST /api/products/sync
 * Syncs products from WooCommerce to Supabase
 */
export async function POST() {
  try {
    const supabase = createServiceClient();

    // Fetch all products from WooCommerce
    console.log("Fetching products from WooCommerce...");
    const wooProducts = await getAllWooProducts();

    if (!wooProducts.length) {
      return NextResponse.json({
        success: false,
        error: "No products found in WooCommerce or API not configured",
      });
    }

    console.log(`Found ${wooProducts.length} products in WooCommerce`);

    // Transform products for our database
    const productsToInsert = wooProducts.map((p: WooProduct) => ({
      woo_id: p.id,
      name: p.name,
      slug: p.slug,
      sku: p.sku || `WOO-${p.id}`,
      price: p.price || "0",
      regular_price: p.regular_price || "0",
      sale_price: p.sale_price || "",
      description: p.short_description || p.description || "",
      category: p.categories?.[0]?.name || "Other",
      category_slug: p.categories?.[0]?.slug || "other",
      image_url: p.images?.[0]?.src || null,
      thumbnail_url: p.images?.[0]?.src || null,
      stock_quantity: p.stock_quantity,
      stock_status: p.stock_status || "instock",
      status: p.status || "publish",
      rating: p.average_rating || "0",
      rating_count: p.rating_count || 0,
      total_sales: p.total_sales || 0,
      date_created: p.date_created,
      date_modified: p.date_modified,
      synced_at: new Date().toISOString(),
    }));

    // Upsert products (insert or update on conflict)
    const { data, error } = await supabase
      .from("woo_products")
      .upsert(productsToInsert, {
        onConflict: "woo_id",
        ignoreDuplicates: false,
      })
      .select("id");

    if (error) {
      console.error("Error syncing products:", error);
      throw error;
    }

    // Get category counts
    const categories = new Map<string, number>();
    wooProducts.forEach((p: WooProduct) => {
      const cat = p.categories?.[0]?.name || "Other";
      categories.set(cat, (categories.get(cat) || 0) + 1);
    });

    return NextResponse.json({
      success: true,
      synced: productsToInsert.length,
      categories: Object.fromEntries(categories),
      message: `Successfully synced ${productsToInsert.length} products from WooCommerce`,
    });
  } catch (error) {
    console.error("Product sync error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to sync products",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/products/sync
 * Returns sync status
 */
export async function GET() {
  try {
    const supabase = createServiceClient();

    const { count, error } = await supabase
      .from("woo_products")
      .select("*", { count: "exact", head: true });

    if (error) {
      if (error.code === "42P01") {
        return NextResponse.json({
          synced: false,
          count: 0,
          message: "Products table not created. Run sync to create.",
        });
      }
      throw error;
    }

    // Get last sync time
    const { data: lastSync } = await supabase
      .from("woo_products")
      .select("synced_at")
      .order("synced_at", { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({
      synced: (count || 0) > 0,
      count: count || 0,
      lastSync: lastSync?.synced_at || null,
    });
  } catch (error) {
    console.error("Sync status error:", error);
    return NextResponse.json(
      { error: "Failed to get sync status" },
      { status: 500 }
    );
  }
}
