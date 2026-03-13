import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const { createServiceClient } = await import("../lib/supabase");
  const supabase = createServiceClient() as any;

  // 1. cin7_order_items count
  const { count } = await supabase.from("cin7_order_items").select("*", { count: "exact", head: true });
  console.log(`cin7_order_items: ${count} records (was 336)`);

  // 2. Test IFNCV (GFRC Premix)
  const { count: ifncvCount } = await supabase.from("cin7_order_items").select("*", { count: "exact", head: true }).eq("sku", "IFNCV");
  console.log(`\nIFNCV orders: ${ifncvCount}`);

  // 3. Test N6MNX variants (Black Onyx)
  const { count: onyxCount } = await supabase.from("cin7_order_items").select("*", { count: "exact", head: true }).like("sku", "N6MNX%");
  console.log(`N6MNX% orders: ${onyxCount}`);

  // 4. Test 9E537_KG (Flowaid)
  const { count: flowaidCount } = await supabase.from("cin7_order_items").select("*", { count: "exact", head: true }).eq("sku", "9E537_KG");
  console.log(`9E537_KG orders: ${flowaidCount}`);

  // 5. Top 10 products by order count
  const { data: topSkus } = await supabase.from("cin7_order_items").select("sku, product_name").not("sku", "eq", "UNKNOWN");
  const skuCounts = new Map<string, { name: string; count: number }>();
  for (const item of topSkus || []) {
    const existing = skuCounts.get(item.sku) || { name: item.product_name, count: 0 };
    existing.count++;
    skuCounts.set(item.sku, existing);
  }
  const sorted = [...skuCounts.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 10);
  console.log("\nTop 10 products by order frequency:");
  sorted.forEach(([sku, { name, count: c }]) => console.log(`  ${c} orders | ${sku}: ${name}`));

  // 6. Test RPC
  console.log("\n=== RPC Test ===");
  const { data: rpc1, error: e1 } = await supabase.rpc("get_woo_sales_by_sku", { target_sku: "N6MNX", max_rows: 3 });
  if (e1) console.log("RPC error:", e1.message);
  else {
    console.log(`get_woo_sales_by_sku('N6MNX'): ${rpc1?.length} results`);
    rpc1?.forEach((r: any) => console.log(`  ${r.order_date?.split("T")[0]} | ${r.order_number} | ${r.sku} | $${r.total_price}`));
  }

  // 7. UNKNOWN count
  const { count: unknownCount } = await supabase.from("cin7_order_items").select("*", { count: "exact", head: true }).eq("sku", "UNKNOWN");
  console.log(`\nItems with SKU='UNKNOWN': ${unknownCount}`);
}

main().catch(console.error);
