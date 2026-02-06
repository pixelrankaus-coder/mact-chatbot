import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { getSale } from "@/lib/cin7";

interface LineItem {
  ProductID?: string;
  SKU?: string;
  Name?: string;
  Quantity?: number;
  Price?: number;
  Total?: number;
  Discount?: number;
  Tax?: number;
}

/**
 * POST /api/dashboard/sales/products/sync
 * Syncs product line items from Cin7 orders for Best Selling Products
 *
 * Query params:
 * - days: Number of days to sync (default: 90)
 * - limit: Max orders to process (default: 100)
 */
export async function POST(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const days = parseInt(searchParams.get("days") || "90", 10);
  const limit = parseInt(searchParams.get("limit") || "100", 10);

  try {
    const supabase = createServiceClient();

    // Calculate date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get recent orders that need line items synced
    const { data: orders, error: ordersError } = await supabase
      .from("cin7_orders")
      .select("cin7_id, order_number, order_date")
      .gte("order_date", startDate.toISOString().split("T")[0])
      .order("order_date", { ascending: false })
      .limit(limit);

    if (ordersError) {
      console.error("Error fetching orders:", ordersError);
      return NextResponse.json({ error: ordersError.message }, { status: 500 });
    }

    if (!orders || orders.length === 0) {
      return NextResponse.json({
        message: "No orders found in date range",
        synced: 0,
      });
    }

    console.log(`Syncing line items for ${orders.length} orders...`);

    let totalItemsSynced = 0;
    let ordersProcessed = 0;
    let errors: string[] = [];

    // Process orders in batches of 5 to avoid rate limiting
    for (let i = 0; i < orders.length; i += 5) {
      const batch = orders.slice(i, i + 5);

      const batchPromises = batch.map(async (order) => {
        try {
          // Fetch full sale details from Cin7
          const sale = await getSale(order.cin7_id);

          if (!sale) {
            console.log(`No sale data for ${order.order_number}`);
            return { order: order.order_number, items: 0 };
          }

          // Extract line items from Order.Lines or Invoices[0].Lines
          const lines: LineItem[] = sale.Order?.Lines || sale.Invoices?.[0]?.Lines || [];

          if (lines.length === 0) {
            return { order: order.order_number, items: 0 };
          }

          // Transform and upsert line items
          const itemRecords = lines
            .filter((line) => line.Name && line.Quantity)
            .map((line) => ({
              order_cin7_id: order.cin7_id,
              order_number: order.order_number,
              order_date: order.order_date?.split("T")[0],
              product_id: line.ProductID || null,
              sku: line.SKU || "UNKNOWN",
              product_name: line.Name || "Unknown Product",
              quantity: line.Quantity || 1,
              unit_price: line.Price || 0,
              total_price: line.Total || (line.Price || 0) * (line.Quantity || 1),
              discount: line.Discount || 0,
              tax: line.Tax || 0,
            }));

          if (itemRecords.length > 0) {
            const { error: upsertError } = await supabase
              .from("cin7_order_items")
              .upsert(itemRecords, {
                onConflict: "order_cin7_id,sku",
                ignoreDuplicates: false,
              });

            if (upsertError) {
              console.error(`Upsert error for ${order.order_number}:`, upsertError);
              return { order: order.order_number, items: 0, error: upsertError.message };
            }
          }

          return { order: order.order_number, items: itemRecords.length };
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "Unknown error";
          console.error(`Error processing ${order.order_number}:`, errorMsg);
          return { order: order.order_number, items: 0, error: errorMsg };
        }
      });

      const results = await Promise.all(batchPromises);

      for (const result of results) {
        ordersProcessed++;
        totalItemsSynced += result.items;
        if (result.error) {
          errors.push(`${result.order}: ${result.error}`);
        }
      }

      // Small delay between batches to respect rate limits
      if (i + 5 < orders.length) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    return NextResponse.json({
      message: "Product sync completed",
      ordersProcessed,
      itemsSynced: totalItemsSynced,
      days,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    });
  } catch (error) {
    console.error("Product sync error:", error);
    return NextResponse.json(
      { error: "Failed to sync products" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/dashboard/sales/products/sync
 * Returns sync status and summary
 */
export async function GET() {
  try {
    const supabase = createServiceClient();

    // Get item count
    const { count: itemCount } = await supabase
      .from("cin7_order_items")
      .select("*", { count: "exact", head: true });

    // Get unique products count
    const { data: products } = await supabase
      .from("cin7_order_items")
      .select("sku")
      .limit(1000);

    const uniqueSkus = new Set(products?.map((p) => p.sku) || []);

    // Get date range of synced items
    const { data: dateRange } = await supabase
      .from("cin7_order_items")
      .select("order_date")
      .order("order_date", { ascending: true })
      .limit(1);

    const { data: latestDate } = await supabase
      .from("cin7_order_items")
      .select("order_date")
      .order("order_date", { ascending: false })
      .limit(1);

    return NextResponse.json({
      status: "ready",
      itemCount: itemCount || 0,
      uniqueProducts: uniqueSkus.size,
      dateRange: {
        from: dateRange?.[0]?.order_date || null,
        to: latestDate?.[0]?.order_date || null,
      },
    });
  } catch (error) {
    console.error("Sync status error:", error);
    return NextResponse.json(
      { error: "Failed to get sync status" },
      { status: 500 }
    );
  }
}
