import { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "@radix-ui/react-icons";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import ProductList from "@/app/(mact)/products/product-list";

export const metadata: Metadata = {
  title: "Products",
  description: "Product list page with filtering and sorting."
};

async function getProducts() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/products`, {
    cache: "no-store"
  });
  if (!res.ok) {
    return { products: [], stats: { totalSales: 0, numberOfSales: 0, totalProducts: 0 } };
  }
  return res.json();
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
