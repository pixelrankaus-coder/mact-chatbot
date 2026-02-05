import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// Debug endpoint to check WooCommerce order dates
export async function GET() {
  const supabase = createServiceClient();

  // Get all orders and find corrupted ones
  const { data: orders, error } = await supabase
    .from("woo_orders")
    .select("woo_id, order_number, order_date, raw_data")
    .order("woo_id", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Find corrupted date (Jan 23, 2026)
  const corruptDate = "2026-01-23";

  const corrupted = orders?.filter((o) => {
    const rawData = o.raw_data as Record<string, unknown> | null;
    const dateCreated = (rawData?.date_created || "") as string;
    return dateCreated.startsWith(corruptDate);
  }) || [];

  const good = orders?.filter((o) => {
    const rawData = o.raw_data as Record<string, unknown> | null;
    const dateCreated = (rawData?.date_created || "") as string;
    return dateCreated && !dateCreated.startsWith(corruptDate);
  }) || [];

  // Find boundary
  const corruptedIds = corrupted.map(o => o.woo_id).sort((a, b) => a - b);
  const goodIds = good.map(o => o.woo_id).sort((a, b) => a - b);

  return NextResponse.json({
    total_orders: orders?.length || 0,
    corrupted_count: corrupted.length,
    good_count: good.length,
    corrupted_range: corruptedIds.length > 0 ? { min: corruptedIds[0], max: corruptedIds[corruptedIds.length - 1] } : null,
    good_range: goodIds.length > 0 ? { min: goodIds[0], max: goodIds[goodIds.length - 1] } : null,
    sample_corrupted: corrupted.slice(0, 3).map(o => ({ id: o.woo_id, num: o.order_number })),
    sample_good: good.slice(0, 3).map(o => ({ id: o.woo_id, num: o.order_number, date: (o.raw_data as Record<string, unknown>)?.date_created })),
    message: "Corrupted orders have date_created set to Jan 23, 2026 in WooCommerce itself"
  });
}
