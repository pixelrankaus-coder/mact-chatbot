import { Metadata } from "next";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InventoryList } from "@/app/(mact)/products/inventory-list";
import { createServiceClient } from "@/lib/supabase";
import { Package, AlertTriangle, TruckIcon, WarehouseIcon } from "lucide-react";

export const metadata: Metadata = {
  title: "Products & Inventory",
  description: "Product inventory with Cin7 stock levels.",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any;

interface Cin7Product {
  cin7_id: string;
  sku: string;
  name: string;
  category: string | null;
  brand: string | null;
  type: string | null;
  cin7_status: string | null;
  weight: number;
  uom: string | null;
  price_tier_1: number;
  price_tiers: Record<string, number> | null;
  average_cost: number;
  sellable: boolean;
  min_before_reorder: number;
  default_location: string | null;
  image_url: string | null;
  last_synced_at: string | null;
}

interface StockRecord {
  cin7_product_id: string;
  location: string;
  on_hand: number;
  available: number;
  on_order: number;
  in_transit: number;
}

export interface InventoryProduct extends Cin7Product {
  stock_on_hand: number;
  stock_available: number;
  stock_on_order: number;
  stock_locations: StockRecord[];
}

async function getCin7Inventory() {
  try {
    const supabase = createServiceClient() as SupabaseAny;

    const { data: products, error, count } = await supabase
      .from("cin7_products")
      .select("cin7_id, sku, name, category, brand, type, cin7_status, weight, uom, price_tier_1, price_tiers, average_cost, sellable, min_before_reorder, default_location, image_url, last_synced_at", { count: "exact" })
      .eq("sellable", true)
      .order("name", { ascending: true })
      .limit(500);

    if (error) {
      console.error("Cin7 inventory query error:", error);
      return { products: [], stats: { total: 0, inStock: 0, outOfStock: 0, lowStock: 0, onOrder: 0 } };
    }

    // Get stock data
    const cin7Ids = (products || []).map((p: Cin7Product) => p.cin7_id).filter(Boolean);
    let stockMap: Record<string, { total_on_hand: number; total_available: number; total_on_order: number; locations: StockRecord[] }> = {};

    if (cin7Ids.length > 0) {
      const { data: stockData } = await supabase
        .from("cin7_product_stock")
        .select("cin7_product_id, location, on_hand, available, on_order, in_transit")
        .in("cin7_product_id", cin7Ids);

      if (stockData) {
        for (const s of stockData as StockRecord[]) {
          const pid = s.cin7_product_id;
          if (!stockMap[pid]) stockMap[pid] = { total_on_hand: 0, total_available: 0, total_on_order: 0, locations: [] };
          stockMap[pid].total_on_hand += s.on_hand || 0;
          stockMap[pid].total_available += s.available || 0;
          stockMap[pid].total_on_order += s.on_order || 0;
          stockMap[pid].locations.push(s);
        }
      }
    }

    const enriched: InventoryProduct[] = (products || []).map((p: Cin7Product) => {
      const stock = stockMap[p.cin7_id];
      return {
        ...p,
        stock_on_hand: stock?.total_on_hand ?? 0,
        stock_available: stock?.total_available ?? 0,
        stock_on_order: stock?.total_on_order ?? 0,
        stock_locations: stock?.locations ?? [],
      };
    });

    // Only count Stock-type products for stock stats
    const stockProducts = enriched.filter((p) => p.type === "Stock");
    const inStock = stockProducts.filter((p) => p.stock_available > 0).length;
    const outOfStock = stockProducts.filter((p) => p.stock_available === 0).length;
    const lowStock = stockProducts.filter((p) => {
      return p.stock_available > 0 && p.min_before_reorder > 0 && p.stock_available <= p.min_before_reorder;
    }).length;
    const onOrder = enriched.filter((p) => p.stock_on_order > 0).length;

    return {
      products: enriched,
      stats: { total: count || 0, inStock, outOfStock, lowStock, onOrder },
    };
  } catch (err) {
    console.error("getCin7Inventory error:", err);
    return { products: [], stats: { total: 0, inStock: 0, outOfStock: 0, lowStock: 0, onOrder: 0 } };
  }
}

export default async function Page() {
  const cin7 = await getCin7Inventory();
  const hasCin7Data = cin7.products.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Products & Inventory</h1>
      </div>

      {/* Stats Cards */}
      {hasCin7Data && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardDescription className="flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" /> Total Products
              </CardDescription>
              <CardTitle className="font-display text-2xl lg:text-3xl">
                {cin7.stats.total.toLocaleString()}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription className="flex items-center gap-1.5">
                <WarehouseIcon className="h-3.5 w-3.5" /> In Stock
              </CardDescription>
              <CardTitle className="font-display text-2xl lg:text-3xl">
                {cin7.stats.inStock.toLocaleString()}
              </CardTitle>
              {cin7.stats.lowStock > 0 && (
                <Badge variant="warning" className="w-fit">
                  {cin7.stats.lowStock} low
                </Badge>
              )}
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> Out of Stock
              </CardDescription>
              <CardTitle className="font-display text-2xl lg:text-3xl text-red-600">
                {cin7.stats.outOfStock.toLocaleString()}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription className="flex items-center gap-1.5">
                <TruckIcon className="h-3.5 w-3.5" /> On Order
              </CardDescription>
              <CardTitle className="font-display text-2xl lg:text-3xl">
                {cin7.stats.onOrder.toLocaleString()}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Inventory List */}
      <div className="pt-2">
        <div className="text-sm text-muted-foreground mb-3">
          {cin7.stats.total.toLocaleString()} products
        </div>
        {hasCin7Data ? (
          <InventoryList data={cin7.products} />
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg font-medium">No inventory data yet</p>
            <p className="text-sm mt-1">
              Run the inventory sync to pull products from Cin7.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
