"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Package,
  Mail,
  User,
  MapPin,
  ExternalLink,
  Loader2,
  Calendar,
  Truck,
  DollarSign,
  Hash,
} from "lucide-react";
import type { UnifiedOrder } from "@/types/order";

const CIN7_BASE_URL = "https://inventory.dearsystems.com";
const WOO_BASE_URL = process.env.NEXT_PUBLIC_WOOCOMMERCE_URL || "https://mact.au";

// Source badge component
function SourceBadge({ source }: { source: "cin7" | "woocommerce" }) {
  if (source === "cin7") {
    return (
      <Badge
        variant="outline"
        className="bg-green-50 text-green-700 text-xs border-green-200"
      >
        Cin7
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="bg-purple-50 text-purple-700 text-xs border-purple-200"
    >
      WooCommerce
    </Badge>
  );
}

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [order, setOrder] = useState<UnifiedOrder | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOrder() {
      try {
        const res = await fetch(`/api/orders/${id}`);
        const data = await res.json();
        if (res.ok) {
          setOrder(data.order);
        }
      } catch (error) {
        console.error("Failed to fetch order:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchOrder();
  }, [id]);

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "completed":
      case "invoiced":
        return "bg-green-100 text-green-700";
      case "processing":
      case "picking":
      case "packed":
      case "approved":
        return "bg-blue-100 text-blue-700";
      case "shipped":
        return "bg-purple-100 text-purple-700";
      case "pending":
      case "on-hold":
      case "draft":
      case "ordering":
        return "bg-yellow-100 text-yellow-700";
      case "cancelled":
      case "refunded":
      case "failed":
      case "void":
        return "bg-red-100 text-red-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  // Get external link URL
  const getExternalUrl = () => {
    if (!order) return null;
    if (order.source === "cin7" && order.cin7Id) {
      return `${CIN7_BASE_URL}/Sale/SaleOrder?ID=${order.cin7Id}`;
    }
    if (order.source === "woocommerce" && order.wooId) {
      return `${WOO_BASE_URL}/wp-admin/post.php?post=${order.wooId}&action=edit`;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <Package className="h-12 w-12 text-slate-300" />
        <p className="text-slate-500">Order not found</p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Go Back
        </Button>
      </div>
    );
  }

  const subtotal = order.items.reduce((sum, item) => sum + item.total, 0);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">
                Order {order.orderNumber}
              </h1>
              <Badge className={getStatusColor(order.status)}>
                {order.statusLabel}
              </Badge>
              <SourceBadge source={order.source} />
            </div>
            <p className="text-slate-500">
              {order.source === "cin7" ? `Cin7 ID: ${order.cin7Id}` : `Woo ID: ${order.wooId}`}
            </p>
          </div>
        </div>
        {getExternalUrl() && (
          <Button
            variant="outline"
            onClick={() => window.open(getExternalUrl(), "_blank")}
            className="gap-2"
          >
            {order.source === "cin7" ? (
              <span className="w-2 h-2 rounded-full bg-green-500" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-purple-500" />
            )}
            Open in {order.source === "cin7" ? "Cin7" : "WooCommerce"}
            <ExternalLink className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-slate-50 p-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Order Summary Card */}
          <Card className="border-0 shadow-sm lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Package className="h-5 w-5 text-blue-600" />
                Order Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Order Info */}
              <div className="flex items-start gap-3">
                <Hash className="mt-0.5 h-4 w-4 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">Order Number</p>
                  <p className="text-sm font-medium">{order.orderNumber}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="mt-0.5 h-4 w-4 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">Order Date</p>
                  <p className="text-sm">
                    {new Date(order.orderDate).toLocaleDateString("en-AU", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <DollarSign className="mt-0.5 h-4 w-4 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">Total</p>
                  <p className="text-sm font-medium">
                    ${order.total.toFixed(2)} {order.currency}
                  </p>
                </div>
              </div>

              {/* Customer Info */}
              <div className="border-t pt-4 mt-4">
                <p className="text-xs font-medium text-slate-700 mb-3">Customer</p>

                {order.customerName && (
                  <div className="flex items-start gap-3 mb-2">
                    <User className="mt-0.5 h-4 w-4 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500">Name</p>
                      <p className="text-sm">{order.customerName}</p>
                    </div>
                  </div>
                )}

                {order.customerEmail && (
                  <div className="flex items-start gap-3 mb-2">
                    <Mail className="mt-0.5 h-4 w-4 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500">Email</p>
                      <a
                        href={`mailto:${order.customerEmail}`}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        {order.customerEmail}
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Shipping Info */}
              {order.shippingAddress && (
                <div className="border-t pt-4 mt-4">
                  <p className="text-xs font-medium text-slate-700 mb-3">Shipping</p>

                  <div className="flex items-start gap-3 mb-2">
                    <MapPin className="mt-0.5 h-4 w-4 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500">Address</p>
                      <p className="text-sm">
                        {order.shippingAddress.address1}
                        {order.shippingAddress.address2 && (
                          <>, {order.shippingAddress.address2}</>
                        )}
                      </p>
                      <p className="text-sm">
                        {[
                          order.shippingAddress.city,
                          order.shippingAddress.state,
                          order.shippingAddress.postcode,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                      {order.shippingAddress.country && (
                        <p className="text-sm">{order.shippingAddress.country}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Tracking Info */}
              {(order.trackingNumber || order.carrier) && (
                <div className="border-t pt-4 mt-4">
                  <p className="text-xs font-medium text-slate-700 mb-3">Tracking</p>

                  {order.carrier && (
                    <div className="flex items-start gap-3 mb-2">
                      <Truck className="mt-0.5 h-4 w-4 text-slate-400" />
                      <div>
                        <p className="text-xs text-slate-500">Carrier</p>
                        <p className="text-sm">{order.carrier}</p>
                      </div>
                    </div>
                  )}

                  {order.trackingNumber && (
                    <div className="flex items-start gap-3 mb-2">
                      <Package className="mt-0.5 h-4 w-4 text-slate-400" />
                      <div>
                        <p className="text-xs text-slate-500">Tracking Number</p>
                        <p className="text-sm font-mono">{order.trackingNumber}</p>
                      </div>
                    </div>
                  )}

                  {order.shippedDate && (
                    <div className="flex items-start gap-3 mb-2">
                      <Calendar className="mt-0.5 h-4 w-4 text-slate-400" />
                      <div>
                        <p className="text-xs text-slate-500">Shipped Date</p>
                        <p className="text-sm">
                          {new Date(order.shippedDate).toLocaleDateString("en-AU")}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Line Items Card */}
          <Card className="border-0 shadow-sm lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Package className="h-5 w-5 text-blue-600" />
                Line Items ({order.items.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {order.items.length === 0 ? (
                <div className="py-8 text-center">
                  <Package className="mx-auto h-10 w-10 text-slate-300" />
                  <p className="mt-2 text-slate-500">No items in this order</p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-center">Qty</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {order.items.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{item.name}</p>
                              {item.sku && (
                                <p className="text-xs text-slate-500">
                                  SKU: {item.sku}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {item.quantity}
                          </TableCell>
                          <TableCell className="text-right">
                            ${item.price.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            ${item.total.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Totals */}
                  <div className="mt-4 border-t pt-4">
                    <div className="flex justify-end">
                      <div className="w-64 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Subtotal</span>
                          <span>${subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-medium text-lg border-t pt-2">
                          <span>Total</span>
                          <span>${order.total.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
