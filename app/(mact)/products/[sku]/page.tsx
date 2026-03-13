import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SalesTrendChart } from "./sales-trend-chart";
import { SyncStockButton } from "./sync-stock-button";
import {
  ArrowLeft,
  Package,
  DollarSign,
  TrendingUp,
  WarehouseIcon,
  ShoppingCart,
  MapPin,
  Scale,
  Ruler,
  Box,
  Globe,
  Barcode,
  Tag,
} from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SA = any;

export async function generateMetadata({ params }: { params: Promise<{ sku: string }> }): Promise<Metadata> {
  const { sku } = await params;
  return { title: `Product: ${decodeURIComponent(sku)}` };
}

async function getProductDetail(sku: string) {
  const supabase = createServiceClient() as SA;

  // Cin7 product — try exact match first, then base SKU match
  let { data: cin7Product } = await supabase
    .from("cin7_products")
    .select("*")
    .eq("sku", sku)
    .single();

  // If no exact match, try as base SKU (WooCommerce uses base, Cin7 has variants like SKU-01, SKU-03)
  let cin7Variants: SA[] = [];
  if (!cin7Product) {
    const { data: variants } = await supabase
      .from("cin7_products")
      .select("*")
      .like("sku", `${sku}-%`);
    cin7Variants = variants || [];
    // Use first variant as the primary product for display
    if (cin7Variants.length > 0) {
      cin7Product = cin7Variants[0];
    }
  }

  // WooCommerce product
  const { data: wooProduct } = await supabase
    .from("woo_products")
    .select("*")
    .eq("sku", sku)
    .single();

  if (!cin7Product && !wooProduct) return null;

  // Collect all related SKUs for sales lookup (base SKU + all variants)
  const relatedSkus = new Set<string>([sku]);
  if (cin7Product) relatedSkus.add(cin7Product.sku);
  for (const v of cin7Variants) relatedSkus.add(v.sku);
  const skuList = Array.from(relatedSkus);

  // Stock levels — aggregate across all variants
  let stockLocations: SA[] = [];
  const cin7Ids = cin7Variants.length > 0
    ? cin7Variants.map((v: SA) => v.cin7_id).filter(Boolean)
    : cin7Product?.cin7_id ? [cin7Product.cin7_id] : [];

  if (cin7Ids.length > 0) {
    const { data } = await supabase
      .from("cin7_product_stock")
      .select("location, on_hand, allocated, available, on_order, in_transit, stock_on_hand, bin, last_synced_at")
      .in("cin7_product_id", cin7Ids);
    stockLocations = data || [];
  }

  // --- Cin7 Sales History ---
  const { data: salesRaw } = await supabase
    .from("cin7_order_items")
    .select("order_number, order_date, quantity, unit_price, total_price")
    .in("sku", skuList)
    .order("order_date", { ascending: false })
    .limit(50);

  let cin7Sales: SA[] = [];
  if (salesRaw?.length > 0) {
    const orderNumbers = [...new Set(salesRaw.map((s: SA) => s.order_number))];
    const { data: orders } = await supabase
      .from("cin7_orders")
      .select("order_number, customer_name, status, status_label, invoice_status")
      .in("order_number", orderNumbers);
    const orderMap = new Map<string, SA>();
    orders?.forEach((o: SA) => orderMap.set(o.order_number, o));

    cin7Sales = salesRaw.map((s: SA) => {
      const order = orderMap.get(s.order_number);
      return { ...s, customer_name: order?.customer_name, order_status: order?.status_label || order?.status, source: "cin7" };
    });
  }

  const salesHistory = cin7Sales;

  // --- All sales for stats (Cin7) ---
  const { data: allCin7Sales } = await supabase
    .from("cin7_order_items")
    .select("quantity, total_price, order_date")
    .in("sku", skuList);

  const salesStats = { totalRevenue: 0, totalUnits: 0, orderCount: 0, avgOrderValue: 0, lastOrderDate: null as string | null };
  if (allCin7Sales && allCin7Sales.length > 0) {
    salesStats.orderCount = allCin7Sales.length;
    salesStats.totalRevenue = allCin7Sales.reduce((s: number, r: SA) => s + (r.total_price || 0), 0);
    salesStats.totalUnits = allCin7Sales.reduce((s: number, r: SA) => s + (r.quantity || 0), 0);
    salesStats.avgOrderValue = salesStats.totalRevenue / salesStats.orderCount;
    const dates = allCin7Sales.map((s: SA) => s.order_date).filter(Boolean).sort();
    salesStats.lastOrderDate = dates[dates.length - 1] || null;
  }

  // Monthly trend (Cin7 only)
  const monthly: Record<string, { revenue: number; units: number }> = {};
  (allCin7Sales || []).forEach((s: SA) => {
    if (!s.order_date) return;
    const m = typeof s.order_date === "string" ? s.order_date.slice(0, 7) : "";
    if (!m) return;
    if (!monthly[m]) monthly[m] = { revenue: 0, units: 0 };
    monthly[m].revenue += s.total_price || 0;
    monthly[m].units += s.quantity || 0;
  });
  const salesTrend = Object.entries(monthly).sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([month, d]) => ({ month, ...d }));

  // Stock totals
  const stockTotals = {
    onHand: stockLocations.reduce((s: number, r: SA) => s + (r.on_hand || 0), 0),
    available: stockLocations.reduce((s: number, r: SA) => s + (r.available || 0), 0),
    allocated: stockLocations.reduce((s: number, r: SA) => s + (r.allocated || 0), 0),
    onOrder: stockLocations.reduce((s: number, r: SA) => s + (r.on_order || 0), 0),
    inTransit: stockLocations.reduce((s: number, r: SA) => s + (r.in_transit || 0), 0),
  };

  return { cin7Product, wooProduct, cin7Variants, stockLocations, salesHistory, salesStats, salesTrend, stockTotals };
}

function formatCurrency(val: number) {
  return `$${val.toFixed(2)}`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

export default async function ProductDetailPage({ params }: { params: Promise<{ sku: string }> }) {
  const { sku } = await params;
  const decodedSku = decodeURIComponent(sku);
  const data = await getProductDetail(decodedSku);

  if (!data) notFound();

  const { cin7Product: p, wooProduct: woo, cin7Variants, stockLocations, salesHistory, salesStats, salesTrend, stockTotals } = data;
  const product = p || woo;
  const priceTiers = p?.price_tiers as Record<string, number> | null;
  const isStockType = p?.type === "Stock";

  // Margin calculation
  const rrp = p?.price_tier_1 || 0;
  const cost = p?.average_cost || 0;
  const margin = rrp > 0 && cost > 0 ? ((rrp - cost) / rrp) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/products"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight truncate">{product.name}</h1>
            {p?.cin7_status && (
              <Badge variant={p.cin7_status === "Active" ? "success" : "secondary"}>{p.cin7_status}</Badge>
            )}
            {p?.type && <Badge variant="outline">{p.type}</Badge>}
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
            <span className="font-mono">{decodedSku}</span>
            {p?.category && <span>{p.category}</span>}
            {p?.brand && <span>{p.brand}</span>}
            {p?.barcode && <span className="flex items-center gap-1"><Barcode className="h-3 w-3" />{p.barcode}</span>}
          </div>
          {cin7Variants.length > 1 && (
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
              <span>Cin7 variants:</span>
              {cin7Variants.map((v: SA) => (
                <Badge key={v.sku} variant="outline" className="text-[10px] font-mono">{v.sku} — {v.name}</Badge>
              ))}
            </div>
          )}
        </div>
        <SyncStockButton sku={decodedSku} />
        {(product.image_url || woo?.image_url) && (
          <div className="h-16 w-16 rounded-lg border overflow-hidden shrink-0 bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={product.image_url || woo?.image_url} alt={product.name} className="h-full w-full object-cover" />
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" /> Total Revenue</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(salesStats.totalRevenue)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5"><ShoppingCart className="h-3.5 w-3.5" /> Units Sold</CardDescription>
            <CardTitle className="text-2xl">{salesStats.totalUnits.toLocaleString()}</CardTitle>
            <p className="text-xs text-muted-foreground">{salesStats.orderCount} orders</p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> Avg Order Value</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(salesStats.avgOrderValue)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5"><WarehouseIcon className="h-3.5 w-3.5" /> Stock Available</CardDescription>
            <CardTitle className="text-2xl">{isStockType ? stockTotals.available : "N/A"}</CardTitle>
            {stockTotals.onOrder > 0 && <p className="text-xs text-blue-600">+{stockTotals.onOrder} on order</p>}
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" /> Margin</CardDescription>
            <CardTitle className="text-2xl">{margin > 0 ? `${margin.toFixed(1)}%` : "—"}</CardTitle>
            {cost > 0 && <p className="text-xs text-muted-foreground">Cost: {formatCurrency(cost)}</p>}
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column — Sales History + Trend */}
        <div className="lg:col-span-2 space-y-6">
          {/* Monthly Sales Trend */}
          <SalesTrendChart data={salesTrend} />

          {/* Sales History Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sales History</CardTitle>
              <CardDescription>{salesHistory.length} recent orders</CardDescription>
            </CardHeader>
            <CardContent>
              {salesHistory.length > 0 ? (
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salesHistory.map((s: SA, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-sm">
                            <Link href={`/orders/${s.order_number}`} className="text-blue-600 hover:underline">
                              {s.order_number}
                            </Link>
                          </TableCell>
                          <TableCell className="text-sm">{s.order_date ? formatDate(s.order_date) : "—"}</TableCell>
                          <TableCell className="text-sm max-w-[160px] truncate">{s.customer_name || "—"}</TableCell>
                          <TableCell className="text-right font-mono text-sm">{s.quantity}</TableCell>
                          <TableCell className="text-right text-sm">{formatCurrency(s.unit_price || 0)}</TableCell>
                          <TableCell className="text-right font-medium text-sm">{formatCurrency(s.total_price || 0)}</TableCell>
                          <TableCell>
                            <Badge variant={
                              s.order_status === "COMPLETED" || s.order_status === "Completed" || s.order_status === "completed" ? "success"
                                : s.order_status === "CANCELLED" || s.order_status === "cancelled" ? "destructive"
                                  : "outline"
                            } className="text-[10px]">
                              {s.order_status || "—"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No sales history found for this SKU</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column — Stock, Pricing, Specs */}
        <div className="space-y-6">
          {/* Stock by Location */}
          {isStockType && stockLocations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><WarehouseIcon className="h-4 w-4" /> Stock by Location</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {stockLocations.map((loc: SA, i: number) => (
                  <div key={i} className="border rounded-lg p-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium text-sm">{loc.location}</span>
                      {loc.bin && <span className="text-xs text-muted-foreground">Bin: {loc.bin}</span>}
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">On Hand</span><span className="font-mono">{loc.on_hand}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Available</span><span className="font-mono font-medium">{loc.available}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Allocated</span><span className="font-mono">{loc.allocated}</span></div>
                      {loc.on_order > 0 && <div className="flex justify-between"><span className="text-blue-600">On Order</span><span className="font-mono text-blue-600">{loc.on_order}</span></div>}
                      {loc.in_transit > 0 && <div className="flex justify-between"><span className="text-amber-600">In Transit</span><span className="font-mono text-amber-600">{loc.in_transit}</span></div>}
                    </div>
                  </div>
                ))}
                {/* Reorder info */}
                {p?.min_before_reorder > 0 && (
                  <div className="border-t pt-3 mt-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Reorder Point</span>
                      <span className="font-mono">{p.min_before_reorder}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Reorder Qty</span>
                      <span className="font-mono">{p.reorder_quantity}</span>
                    </div>
                    {stockTotals.available <= p.min_before_reorder && (
                      <Badge variant="warning" className="mt-2">Below reorder point</Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Price Tiers */}
          {priceTiers && Object.keys(priceTiers).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Tag className="h-4 w-4" /> Price Tiers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {Object.entries(priceTiers).map(([name, price]) => (
                    <div key={name} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{name}</span>
                      <span className={`font-mono ${price > 0 ? "" : "text-muted-foreground"}`}>
                        {price > 0 ? formatCurrency(price) : "—"}
                      </span>
                    </div>
                  ))}
                  {cost > 0 && (
                    <div className="flex justify-between text-sm border-t pt-1.5 mt-1.5">
                      <span className="text-muted-foreground font-medium">Avg Cost</span>
                      <span className="font-mono">{formatCurrency(cost)}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* WooCommerce Info */}
          {woo && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4" /> WooCommerce</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Price</span><span>${woo.price}</span></div>
                {woo.regular_price && woo.regular_price !== woo.price && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Regular</span><span className="line-through">${woo.regular_price}</span></div>
                )}
                {woo.sale_price && <div className="flex justify-between"><span className="text-red-600">Sale</span><span className="text-red-600">${woo.sale_price}</span></div>}
                <div className="flex justify-between"><span className="text-muted-foreground">Stock</span><span>{woo.stock_quantity ?? "N/A"} ({woo.stock_status})</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Total Sales</span><span>{woo.total_sales || 0}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Rating</span><span>{woo.rating}/5 ({woo.rating_count || 0})</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Status</span>
                  <Badge variant={woo.status === "publish" ? "success" : "secondary"}>{woo.status}</Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Product Specifications */}
          {p && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4" /> Specifications</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                {p.weight > 0 && (
                  <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1"><Scale className="h-3 w-3" /> Weight</span><span>{p.weight} {p.weight_units || "kg"}</span></div>
                )}
                {(p.length > 0 || p.width > 0 || p.height > 0) && (
                  <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1"><Ruler className="h-3 w-3" /> Dimensions</span><span>{p.length} x {p.width} x {p.height} {p.dimensions_units || "cm"}</span></div>
                )}
                {p.uom && <div className="flex justify-between"><span className="text-muted-foreground">UOM</span><span>{p.uom}</span></div>}
                {p.costing_method && <div className="flex justify-between"><span className="text-muted-foreground">Costing</span><span>{p.costing_method}</span></div>}
                {p.default_location && <div className="flex justify-between"><span className="text-muted-foreground">Default Location</span><span>{p.default_location}</span></div>}
                {(p.carton_length || p.carton_width || p.carton_height) && (
                  <>
                    <div className="border-t pt-1.5 mt-1.5 font-medium flex items-center gap-1"><Box className="h-3 w-3" /> Carton</div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Carton Size</span><span>{p.carton_length} x {p.carton_width} x {p.carton_height}</span></div>
                    {p.carton_quantity && <div className="flex justify-between"><span className="text-muted-foreground">Units/Carton</span><span>{p.carton_quantity}</span></div>}
                  </>
                )}
                {p.hs_code && <div className="flex justify-between"><span className="text-muted-foreground">HS Code</span><span>{p.hs_code}</span></div>}
                {p.country_of_origin && <div className="flex justify-between"><span className="text-muted-foreground">Origin</span><span>{p.country_of_origin}</span></div>}
                {p.tags && <div className="flex justify-between"><span className="text-muted-foreground">Tags</span><span>{p.tags}</span></div>}
                {p.last_synced_at && (
                  <div className="text-xs text-muted-foreground border-t pt-1.5 mt-1.5">
                    Last synced: {formatDate(p.last_synced_at)}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
