"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, RefreshCw, TrendingUp, TrendingDown, Minus, Beaker, Wrench, Box } from "lucide-react";
import Image from "next/image";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Product {
  rank: number;
  name: string;
  sku: string;
  category: string;
  unitsSold: number;
  revenue: number;
  trend: number;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
}

// Category icons for fallback when no image
const CATEGORY_ICONS: Record<string, React.ElementType> = {
  "gfrc-premix": Box,
  "additives": Beaker,
  "fiberglass": Package,
  "tools": Wrench,
  "equipment": Wrench,
  "other": Package,
};

// Category colors for fallback backgrounds
const CATEGORY_COLORS: Record<string, string> = {
  "gfrc-premix": "bg-blue-100 text-blue-600",
  "additives": "bg-purple-100 text-purple-600",
  "fiberglass": "bg-amber-100 text-amber-600",
  "tools": "bg-green-100 text-green-600",
  "equipment": "bg-slate-100 text-slate-600",
  "other": "bg-gray-100 text-gray-600",
};

interface ProductsData {
  products: Product[];
  summary: {
    totalProducts: number;
    totalUnitsSold: number;
    totalRevenue: number;
  };
  period: string;
  category: string;
  availableCategories?: string[];
  needsSync?: boolean;
  message?: string;
}

const PERIODS = [
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "180d", label: "180 days" },
  { value: "365d", label: "1 year" },
];

const CATEGORIES = [
  { value: "all", label: "All Products" },
  { value: "gfrc-premix", label: "GFRC Premix" },
  { value: "additives", label: "Additives" },
  { value: "tools", label: "Tools" },
  { value: "other", label: "Other" },
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function BestSellingProducts() {
  const [data, setData] = useState<ProductsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [period, setPeriod] = useState("90d");
  const [category, setCategory] = useState("all");

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/dashboard/sales/products?limit=6&period=${period}&category=${category}`);
      if (!response.ok) throw new Error("Failed to fetch products");
      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error("Error fetching products:", err);
    } finally {
      setLoading(false);
    }
  }, [period, category]);

  const syncProducts = async () => {
    try {
      setSyncing(true);
      const response = await fetch("/api/dashboard/sales/products/sync?days=90&limit=100", {
        method: "POST",
      });
      if (!response.ok) throw new Error("Sync failed");
      const result = await response.json();
      console.log("Sync result:", result);
      // Refresh products after sync
      await fetchProducts();
    } catch (err) {
      console.error("Error syncing products:", err);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  if (loading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Best Selling Products</CardTitle>
          <CardDescription>Top-Selling Products at a Glance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center justify-between rounded-md border px-4 py-3">
              <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-md" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  // Show sync prompt if no data
  if (data?.needsSync || !data?.products?.length) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Best Selling Products</CardTitle>
          <CardDescription>Top-Selling MACt Products</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <Package className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">
            Product data needs to be synced from Cin7
          </p>
          <Button onClick={syncProducts} disabled={syncing}>
            {syncing ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync Products
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const periodLabel = PERIODS.find((p) => p.value === period)?.label || period;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Best Selling Products</CardTitle>
        <CardDescription>Top MACt products ({periodLabel})</CardDescription>
        <CardAction>
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[100px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="outline" className="h-8 w-8" onClick={syncProducts} disabled={syncing}>
                    <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{syncing ? "Syncing..." : "Refresh from Cin7"}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.products.map((product) => {
          const CategoryIcon = CATEGORY_ICONS[product.category] || Package;
          const categoryColor = CATEGORY_COLORS[product.category] || CATEGORY_COLORS.other;

          return (
          <div
            key={product.sku}
            className="flex items-center justify-between rounded-md border px-4 py-3 hover:bg-muted transition-colors"
          >
            <div className="flex items-center gap-4">
              {product.imageUrl || product.thumbnailUrl ? (
                <div className="relative h-10 w-10 rounded-md overflow-hidden bg-muted">
                  <Image
                    src={product.thumbnailUrl || product.imageUrl || ""}
                    alt={product.name}
                    fill
                    className="object-cover"
                    sizes="40px"
                  />
                </div>
              ) : (
                <div className={`flex h-10 w-10 items-center justify-center rounded-md ${categoryColor}`}>
                  <CategoryIcon className="h-5 w-5" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm line-clamp-1">{product.name}</div>
                <div className="text-xs text-muted-foreground">{product.sku}</div>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="text-right">
                <div className="font-medium">{formatCurrency(product.revenue)}</div>
                <div className="text-xs text-muted-foreground">{product.unitsSold} sold</div>
              </div>
              <div className="flex items-center gap-1 w-14 justify-end">
                {product.trend > 0 ? (
                  <span className="flex items-center text-green-600 text-xs">
                    <TrendingUp className="h-3 w-3 mr-0.5" />
                    +{product.trend}%
                  </span>
                ) : product.trend < 0 ? (
                  <span className="flex items-center text-red-500 text-xs">
                    <TrendingDown className="h-3 w-3 mr-0.5" />
                    {product.trend}%
                  </span>
                ) : (
                  <span className="flex items-center text-muted-foreground text-xs">
                    <Minus className="h-3 w-3 mr-0.5" />
                    0%
                  </span>
                )}
              </div>
            </div>
          </div>
        );
        })}
        {data.summary && (
          <div className="pt-2 mt-2 border-t text-xs text-muted-foreground flex justify-between">
            <span>{data.summary.totalProducts} products</span>
            <span>{data.summary.totalUnitsSold} units • {formatCurrency(data.summary.totalRevenue)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
