import { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "@radix-ui/react-icons";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import ProductList from "@/app/(mact)/products/product-list";
import { createServiceClient } from "@/lib/supabase";

export const metadata: Metadata = {
  title: "Products",
  description: "Product list page with filtering and sorting."
};

interface ProductRow {
  id: string;
  woo_id: number;
  name: string;
  sku: string;
  price: string;
  category: string;
  image_url: string | null;
  stock_quantity: number | null;
  stock_status: string;
  status: string;
  rating: string;
  total_sales: number;
}

async function getProducts() {
  try {
    const supabase = createServiceClient();

    const { data: products, error, count } = await supabase
      .from("woo_products")
      .select("*", { count: "exact" })
      .order("name", { ascending: true })
      .limit(100);

    if (error) {
      console.error("Error fetching products:", error);
      return { products: [], stats: { totalSales: 0, numberOfSales: 0, totalProducts: 0, outOfStock: 0 } };
    }

    // Transform products
    const transformedProducts = ((products || []) as ProductRow[]).map((p, index) => {
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

    const totalProducts = count || 0;
    const outOfStock = (products || []).filter((p: ProductRow) => p.stock_status === "outofstock").length;
    const totalSales = (products || []).reduce((sum: number, p: ProductRow) => sum + (p.total_sales || 0), 0);

    return {
      products: transformedProducts,
      stats: {
        totalSales: totalSales * 100,
        numberOfSales: totalSales,
        totalProducts,
        outOfStock,
      },
    };
  } catch (error) {
    console.error("Products fetch error:", error);
    return { products: [], stats: { totalSales: 0, numberOfSales: 0, totalProducts: 0, outOfStock: 0 } };
  }
}

export default async function Page() {
  const { products, stats } = await getProducts();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Products</h1>
        <Button asChild>
          <Link href="/products/create">
            <PlusIcon /> Add Product
          </Link>
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Total Sales</CardDescription>
            <CardTitle className="font-display text-2xl lg:text-3xl">
              ${stats?.totalSales?.toLocaleString() || "0"}
            </CardTitle>
            <CardAction>
              <Badge variant="outline">
                <span className="text-green-600">+20.1%</span>
              </Badge>
            </CardAction>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Number of Sales</CardDescription>
            <CardTitle className="font-display text-2xl lg:text-3xl">
              {stats?.numberOfSales?.toLocaleString() || "0"}
            </CardTitle>
            <CardAction>
              <Badge variant="outline">
                <span className="text-green-600">+5.02</span>
              </Badge>
            </CardAction>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Total Products</CardDescription>
            <CardTitle className="font-display text-2xl lg:text-3xl">
              {stats?.totalProducts?.toLocaleString() || "0"}
            </CardTitle>
            <CardAction>
              <Badge variant="outline">
                <span className="text-green-600">+3.1%</span>
              </Badge>
            </CardAction>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Out of Stock</CardDescription>
            <CardTitle className="font-display text-2xl lg:text-3xl">
              {stats?.outOfStock?.toLocaleString() || "0"}
            </CardTitle>
            <CardAction>
              <Badge variant="outline">
                <span className="text-red-600">-3.58%</span>
              </Badge>
            </CardAction>
          </CardHeader>
        </Card>
      </div>
      <div className="pt-4">
        <ProductList data={products} />
      </div>
    </div>
  );
}
