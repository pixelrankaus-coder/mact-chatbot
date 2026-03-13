import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { syncSingleProductStock } from "@/lib/cin7-product-sync";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SA = any;

/**
 * POST /api/products/[sku]/sync-stock
 * Syncs stock for a single product from Cin7, returns fresh stock data
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ sku: string }> }
) {
  const { sku } = await params;

  try {
    const supabase = createServiceClient() as SA;

    // Find the Cin7 product(s) for this SKU
    let { data: cin7Product } = await supabase
      .from("cin7_products")
      .select("cin7_id")
      .eq("sku", sku)
      .single();

    let cin7Ids: string[] = [];
    if (cin7Product) {
      cin7Ids = [cin7Product.cin7_id];
    } else {
      // Try variant match
      const { data: variants } = await supabase
        .from("cin7_products")
        .select("cin7_id")
        .like("sku", `${sku}-%`);
      cin7Ids = (variants || []).map((v: SA) => v.cin7_id).filter(Boolean);
    }

    if (cin7Ids.length === 0) {
      return NextResponse.json({ error: "No Cin7 product found for this SKU" }, { status: 404 });
    }

    // Sync stock for each Cin7 product ID
    let totalSynced = 0;
    let totalErrors = 0;
    for (const id of cin7Ids) {
      const result = await syncSingleProductStock(id);
      totalSynced += result.synced;
      totalErrors += result.errors;
    }

    // Return fresh stock data
    const { data: stockLocations } = await supabase
      .from("cin7_product_stock")
      .select("location, on_hand, allocated, available, on_order, in_transit, stock_on_hand, bin, last_synced_at")
      .in("cin7_product_id", cin7Ids);

    return NextResponse.json({
      synced: totalSynced,
      errors: totalErrors,
      stockLocations: stockLocations || [],
    });
  } catch (error) {
    console.error("Single product stock sync error:", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
