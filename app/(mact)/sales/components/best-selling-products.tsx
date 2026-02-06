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
import { ChevronRight, Package, RefreshCw } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Product {
  rank: number;
  name: string;
  sku: string;
  unitsSold: number;
  revenue: number;
}

interface ProductsData {
  products: Product[];
  summary: {
    totalProducts: number;
    totalUnitsSold: number;
    totalRevenue: number;
  };
  needsSync?: boolean;
  message?: string;
}

export function BestSellingProducts() {
  const [data, setData] = useState<ProductsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/dashboard/sales/products?limit=6&period=90d");
      if (!response.ok) throw new Error("Failed to fetch products");
      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error("Error fetching products:", err);
    } finally {
      setLoading(false);
    }
  }, []);

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

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Best Selling Products</CardTitle>
        <CardDescription>Top MACt products (last 90 days)</CardDescription>
        <CardAction>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="outline" onClick={syncProducts} disabled={syncing}>
                  {syncing ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{syncing ? "Syncing..." : "Refresh"}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.products.map((product) => (
          <div
            key={product.sku}
            className="flex items-center justify-between rounded-md border px-4 py-3 hover:bg-muted transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary font-medium">
                {product.rank}
              </div>
              <div>
                <div className="font-medium text-sm line-clamp-1">{product.name}</div>
                <div className="text-xs text-muted-foreground">{product.sku}</div>
              </div>
            </div>
            <div className="text-sm text-green-600 whitespace-nowrap">
              {product.unitsSold} items sold
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
