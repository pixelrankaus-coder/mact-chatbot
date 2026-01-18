"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  User,
  Mail,
  Phone,
  MapPin,
  Building,
  ExternalLink,
  Loader2,
  Package,
  CreditCard,
  Calendar,
  Tag,
  Truck,
  FileText,
  DollarSign,
  Percent,
  Clock,
  ShoppingCart,
  ShoppingBag,
} from "lucide-react";
import type { UnifiedCustomer } from "@/types/customer";
import type { Cin7Sale } from "@/lib/cin7";
import type { WooOrder } from "@/lib/woocommerce";

const CIN7_BASE_URL = "https://inventory.dearsystems.com";
const WOO_BASE_URL = process.env.NEXT_PUBLIC_WOOCOMMERCE_URL || "https://mact.au";

// Source badges component
function SourceBadges({ sources }: { sources: string[] }) {
  return (
    <div className="flex gap-1">
      {sources.includes("cin7") && (
        <Badge variant="outline" className="bg-green-50 text-green-700 text-xs border-green-200">
          Cin7
        </Badge>
      )}
      {sources.includes("woocommerce") && (
        <Badge variant="outline" className="bg-purple-50 text-purple-700 text-xs border-purple-200">
          WooCommerce
        </Badge>
      )}
    </div>
  );
}

export default function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [customer, setCustomer] = useState<UnifiedCustomer | null>(null);
  const [cin7Orders, setCin7Orders] = useState<Cin7Sale[]>([]);
  const [wooOrders, setWooOrders] = useState<WooOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCustomer() {
      try {
        const res = await fetch(`/api/customers/${id}`);
        const data = await res.json();
        if (res.ok) {
          setCustomer(data.customer);
          setCin7Orders(data.cin7Orders || []);
          setWooOrders(data.wooOrders || []);
        }
      } catch (error) {
        console.error("Failed to fetch customer:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchCustomer();
  }, [id]);

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "active":
        return "bg-green-100 text-green-700";
      case "inactive":
        return "bg-gray-100 text-gray-700";
      case "hold":
        return "bg-yellow-100 text-yellow-700";
      case "completed":
        return "bg-green-100 text-green-700";
      case "shipped":
        return "bg-blue-100 text-blue-700";
      case "invoiced":
        return "bg-purple-100 text-purple-700";
      case "processing":
        return "bg-yellow-100 text-yellow-700";
      case "pending":
        return "bg-orange-100 text-orange-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <User className="h-12 w-12 text-slate-300" />
        <p className="text-slate-500">Customer not found</p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Go Back
        </Button>
      </div>
    );
  }

  const totalOrders = cin7Orders.length + wooOrders.length;

  // Calculate sales summary from all orders
  const cin7Total = cin7Orders.reduce((sum, o) => sum + (o.Total || 0), 0);
  const wooTotal = wooOrders.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);
  const totalRevenue = cin7Total + wooTotal;

  // Get last order date from both sources
  const allOrderDates = [
    ...cin7Orders.map((o) => new Date(o.OrderDate)),
    ...wooOrders.map((o) => new Date(o.dateCreated)),
  ].filter((d) => !isNaN(d.getTime()));
  const lastOrderDate = allOrderDates.length > 0
    ? new Date(Math.max(...allOrderDates.map((d) => d.getTime())))
    : null;

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
                {customer.name}
              </h1>
              <Badge className={getStatusColor(customer.status)}>
                {customer.status}
              </Badge>
              <SourceBadges sources={customer.sources} />
            </div>
            <p className="text-slate-500">
              {customer.cin7Id && `Cin7: ${customer.cin7Id}`}
              {customer.cin7Id && customer.wooId && " | "}
              {customer.wooId && `Woo: ${customer.wooId}`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {customer.cin7Id && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                window.open(
                  `${CIN7_BASE_URL}/Customers/View?ID=${customer.cin7Id}`,
                  "_blank"
                )
              }
              className="gap-2"
            >
              <span className="w-2 h-2 rounded-full bg-green-500" />
              Open in Cin7
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}
          {customer.wooId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                window.open(
                  `${WOO_BASE_URL}/wp-admin/user-edit.php?user_id=${customer.wooId}`,
                  "_blank"
                )
              }
              className="gap-2"
            >
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              Open in Woo
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-slate-50 p-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Customer Info Card */}
          <Card className="border-0 shadow-sm lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5 text-blue-600" />
                Customer Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Contact Info */}
              {customer.email && (
                <div className="flex items-start gap-3">
                  <Mail className="mt-0.5 h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500">Email</p>
                    <a
                      href={`mailto:${customer.email}`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {customer.email}
                    </a>
                  </div>
                </div>
              )}
              {customer.phone && (
                <div className="flex items-start gap-3">
                  <Phone className="mt-0.5 h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500">Phone</p>
                    <a
                      href={`tel:${customer.phone}`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {customer.phone}
                    </a>
                  </div>
                </div>
              )}
              {customer.company && customer.company !== customer.name && (
                <div className="flex items-start gap-3">
                  <Building className="mt-0.5 h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500">Company</p>
                    <p className="text-sm">{customer.company}</p>
                  </div>
                </div>
              )}

              {/* Sales Summary */}
              {totalOrders > 0 && (
                <div className="border-t pt-3 mt-3">
                  <p className="text-xs font-medium text-slate-700 mb-2">
                    Sales Summary
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg bg-blue-50 p-3 text-center">
                      <p className="text-2xl font-bold text-blue-700">{totalOrders}</p>
                      <p className="text-xs text-blue-600">Total Orders</p>
                    </div>
                    <div className="rounded-lg bg-green-50 p-3 text-center">
                      <p className="text-2xl font-bold text-green-700">
                        ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-green-600">Total Revenue</p>
                    </div>
                  </div>
                  {lastOrderDate && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                      <Calendar className="h-4 w-4 text-slate-400" />
                      <span>Last order: {lastOrderDate.toLocaleDateString("en-AU", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}</span>
                    </div>
                  )}
                  {(cin7Orders.length > 0 && wooOrders.length > 0) && (
                    <div className="mt-2 flex gap-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        {cin7Orders.length} Cin7
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-purple-500" />
                        {wooOrders.length} WooCommerce
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* WooCommerce Stats */}
              {(customer.totalOrders !== undefined || customer.totalSpent !== undefined) && (
                <div className="border-t pt-3 mt-3">
                  <p className="text-xs font-medium text-slate-700 mb-2">
                    WooCommerce Stats
                  </p>
                  {customer.totalOrders !== undefined && (
                    <div className="flex items-start gap-3 mb-2">
                      <ShoppingCart className="mt-0.5 h-4 w-4 text-slate-400" />
                      <div>
                        <p className="text-xs text-slate-500">Total Orders</p>
                        <p className="text-sm">{customer.totalOrders}</p>
                      </div>
                    </div>
                  )}
                  {customer.totalSpent !== undefined && customer.totalSpent > 0 && (
                    <div className="flex items-start gap-3 mb-2">
                      <DollarSign className="mt-0.5 h-4 w-4 text-slate-400" />
                      <div>
                        <p className="text-xs text-slate-500">Total Spent</p>
                        <p className="text-sm">${customer.totalSpent.toLocaleString()}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Cin7 Business Info */}
              {customer.cin7Data && (
                <div className="border-t pt-3 mt-3">
                  <p className="text-xs font-medium text-slate-700 mb-2">
                    Business Details (Cin7)
                  </p>
                  {customer.cin7Data.currency && (
                    <div className="flex items-start gap-3 mb-2">
                      <DollarSign className="mt-0.5 h-4 w-4 text-slate-400" />
                      <div>
                        <p className="text-xs text-slate-500">Currency</p>
                        <p className="text-sm">{customer.cin7Data.currency}</p>
                      </div>
                    </div>
                  )}
                  {customer.cin7Data.paymentTerm && (
                    <div className="flex items-start gap-3 mb-2">
                      <Calendar className="mt-0.5 h-4 w-4 text-slate-400" />
                      <div>
                        <p className="text-xs text-slate-500">Payment Terms</p>
                        <p className="text-sm">{customer.cin7Data.paymentTerm}</p>
                      </div>
                    </div>
                  )}
                  {customer.cin7Data.creditLimit !== undefined && customer.cin7Data.creditLimit > 0 && (
                    <div className="flex items-start gap-3 mb-2">
                      <CreditCard className="mt-0.5 h-4 w-4 text-slate-400" />
                      <div>
                        <p className="text-xs text-slate-500">Credit Limit</p>
                        <p className="text-sm">
                          ${customer.cin7Data.creditLimit.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  )}
                  {customer.cin7Data.discount !== undefined && customer.cin7Data.discount > 0 && (
                    <div className="flex items-start gap-3 mb-2">
                      <Percent className="mt-0.5 h-4 w-4 text-slate-400" />
                      <div>
                        <p className="text-xs text-slate-500">Discount</p>
                        <p className="text-sm">{customer.cin7Data.discount}%</p>
                      </div>
                    </div>
                  )}
                  {customer.cin7Data.priceTier && (
                    <div className="flex items-start gap-3 mb-2">
                      <Tag className="mt-0.5 h-4 w-4 text-slate-400" />
                      <div>
                        <p className="text-xs text-slate-500">Price Tier</p>
                        <p className="text-sm">{customer.cin7Data.priceTier}</p>
                      </div>
                    </div>
                  )}
                  {customer.cin7Data.taxRule && (
                    <div className="flex items-start gap-3 mb-2">
                      <FileText className="mt-0.5 h-4 w-4 text-slate-400" />
                      <div>
                        <p className="text-xs text-slate-500">Tax Rule</p>
                        <p className="text-sm">{customer.cin7Data.taxRule}</p>
                      </div>
                    </div>
                  )}
                  {customer.cin7Data.taxNumber && (
                    <div className="flex items-start gap-3 mb-2">
                      <FileText className="mt-0.5 h-4 w-4 text-slate-400" />
                      <div>
                        <p className="text-xs text-slate-500">Tax Number (ABN)</p>
                        <p className="text-sm">{customer.cin7Data.taxNumber}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Cin7 Fulfillment Info */}
              {customer.cin7Data &&
                (customer.cin7Data.carrier ||
                  customer.cin7Data.location ||
                  customer.cin7Data.salesRepresentative) && (
                  <div className="border-t pt-3 mt-3">
                    <p className="text-xs font-medium text-slate-700 mb-2">
                      Fulfillment (Cin7)
                    </p>
                    {customer.cin7Data.carrier && (
                      <div className="flex items-start gap-3 mb-2">
                        <Truck className="mt-0.5 h-4 w-4 text-slate-400" />
                        <div>
                          <p className="text-xs text-slate-500">Default Carrier</p>
                          <p className="text-sm">{customer.cin7Data.carrier}</p>
                        </div>
                      </div>
                    )}
                    {customer.cin7Data.location && (
                      <div className="flex items-start gap-3 mb-2">
                        <MapPin className="mt-0.5 h-4 w-4 text-slate-400" />
                        <div>
                          <p className="text-xs text-slate-500">Location</p>
                          <p className="text-sm">{customer.cin7Data.location}</p>
                        </div>
                      </div>
                    )}
                    {customer.cin7Data.salesRepresentative && (
                      <div className="flex items-start gap-3 mb-2">
                        <User className="mt-0.5 h-4 w-4 text-slate-400" />
                        <div>
                          <p className="text-xs text-slate-500">Sales Rep</p>
                          <p className="text-sm">{customer.cin7Data.salesRepresentative}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

              {/* Cin7 Tags */}
              {customer.cin7Data?.tags && (
                <div className="border-t pt-3 mt-3">
                  <p className="text-xs text-slate-500 mb-1">Tags</p>
                  <div className="flex flex-wrap gap-1">
                    {customer.cin7Data.tags.split(",").map((tag, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {tag.trim()}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Activity */}
              {customer.lastUpdated && (
                <div className="border-t pt-3 mt-3">
                  <p className="text-xs font-medium text-slate-700 mb-2">Activity</p>
                  <div className="flex items-start gap-3 mb-2">
                    <Clock className="mt-0.5 h-4 w-4 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500">Last Modified</p>
                      <p className="text-sm">
                        {new Date(customer.lastUpdated).toLocaleDateString("en-AU", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Cin7 Notes */}
              {customer.cin7Data?.comments && (
                <div className="border-t pt-3 mt-3">
                  <p className="text-xs text-slate-500">Notes</p>
                  <p className="mt-1 text-sm text-slate-600 whitespace-pre-wrap">
                    {customer.cin7Data.comments}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tabs Section */}
          <Card className="border-0 shadow-sm lg:col-span-2">
            <Tabs defaultValue="orders" className="w-full">
              <CardHeader className="pb-0">
                <TabsList>
                  <TabsTrigger value="orders" className="gap-2">
                    <Package className="h-4 w-4" />
                    All Orders ({totalOrders})
                  </TabsTrigger>
                  {cin7Orders.length > 0 && (
                    <TabsTrigger value="cin7-orders" className="gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      Cin7 ({cin7Orders.length})
                    </TabsTrigger>
                  )}
                  {wooOrders.length > 0 && (
                    <TabsTrigger value="woo-orders" className="gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-500" />
                      WooCommerce ({wooOrders.length})
                    </TabsTrigger>
                  )}
                  {customer.wooData && (
                    <TabsTrigger value="addresses" className="gap-2">
                      <MapPin className="h-4 w-4" />
                      Addresses
                    </TabsTrigger>
                  )}
                </TabsList>
              </CardHeader>
              <CardContent className="pt-4">
                {/* All Orders Tab */}
                <TabsContent value="orders" className="mt-0">
                  {totalOrders === 0 ? (
                    <div className="py-8 text-center">
                      <Package className="mx-auto h-10 w-10 text-slate-300" />
                      <p className="mt-2 text-slate-500">No orders found</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Source</TableHead>
                          <TableHead>Order #</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cin7Orders.map((order, index) => (
                          <TableRow key={`cin7-${order.ID || index}`}>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className="bg-green-50 text-green-700 text-xs border-green-200"
                              >
                                Cin7
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">
                              {order.OrderNumber}
                            </TableCell>
                            <TableCell>
                              {new Date(order.OrderDate).toLocaleDateString("en-AU")}
                            </TableCell>
                            <TableCell>
                              <Badge className={getStatusColor(order.Status)}>
                                {order.Status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              ${order.Total?.toFixed(2) || "0.00"}
                            </TableCell>
                          </TableRow>
                        ))}
                        {wooOrders.map((order, index) => (
                          <TableRow key={`woo-${order.id || index}`}>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className="bg-purple-50 text-purple-700 text-xs border-purple-200"
                              >
                                Woo
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">
                              #{order.number}
                            </TableCell>
                            <TableCell>
                              {new Date(order.dateCreated).toLocaleDateString("en-AU")}
                            </TableCell>
                            <TableCell>
                              <Badge className={getStatusColor(order.status)}>
                                {order.statusLabel || order.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              ${parseFloat(order.total).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>

                {/* Cin7 Orders Tab */}
                <TabsContent value="cin7-orders" className="mt-0">
                  {cin7Orders.length === 0 ? (
                    <div className="py-8 text-center">
                      <Package className="mx-auto h-10 w-10 text-slate-300" />
                      <p className="mt-2 text-slate-500">No Cin7 orders found</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Order #</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cin7Orders.map((order, index) => (
                          <TableRow key={order.ID || `order-${index}`}>
                            <TableCell className="font-medium">
                              {order.OrderNumber}
                            </TableCell>
                            <TableCell>
                              {new Date(order.OrderDate).toLocaleDateString("en-AU")}
                            </TableCell>
                            <TableCell>
                              <Badge className={getStatusColor(order.Status)}>
                                {order.Status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              ${order.Total?.toFixed(2) || "0.00"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>

                {/* WooCommerce Orders Tab */}
                <TabsContent value="woo-orders" className="mt-0">
                  {wooOrders.length === 0 ? (
                    <div className="py-8 text-center">
                      <ShoppingBag className="mx-auto h-10 w-10 text-slate-300" />
                      <p className="mt-2 text-slate-500">No WooCommerce orders found</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Order #</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {wooOrders.map((order, index) => (
                          <TableRow key={order.id || `woo-order-${index}`}>
                            <TableCell className="font-medium">
                              #{order.number}
                            </TableCell>
                            <TableCell>
                              {new Date(order.dateCreated).toLocaleDateString("en-AU")}
                            </TableCell>
                            <TableCell>
                              <Badge className={getStatusColor(order.status)}>
                                {order.statusLabel || order.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              ${parseFloat(order.total).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>

                {/* Addresses Tab (WooCommerce) */}
                <TabsContent value="addresses" className="mt-0">
                  {customer.wooData ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      {customer.wooData.billing && (
                        <div className="rounded-lg border bg-white p-4">
                          <div className="mb-2 flex items-center gap-2">
                            <Building className="h-4 w-4 text-slate-400" />
                            <span className="text-sm font-medium">Billing Address</span>
                            <Badge
                              variant="outline"
                              className="bg-purple-50 text-purple-700 text-xs border-purple-200"
                            >
                              WooCommerce
                            </Badge>
                          </div>
                          <div className="text-sm text-slate-600">
                            {customer.wooData.billing.address_1 && (
                              <p>{customer.wooData.billing.address_1}</p>
                            )}
                            {customer.wooData.billing.address_2 && (
                              <p>{customer.wooData.billing.address_2}</p>
                            )}
                            <p>
                              {[
                                customer.wooData.billing.city,
                                customer.wooData.billing.state,
                                customer.wooData.billing.postcode,
                              ]
                                .filter(Boolean)
                                .join(", ")}
                            </p>
                            {customer.wooData.billing.country && (
                              <p>{customer.wooData.billing.country}</p>
                            )}
                          </div>
                        </div>
                      )}
                      {customer.wooData.shipping && (
                        <div className="rounded-lg border bg-white p-4">
                          <div className="mb-2 flex items-center gap-2">
                            <Truck className="h-4 w-4 text-slate-400" />
                            <span className="text-sm font-medium">Shipping Address</span>
                            <Badge
                              variant="outline"
                              className="bg-purple-50 text-purple-700 text-xs border-purple-200"
                            >
                              WooCommerce
                            </Badge>
                          </div>
                          <div className="text-sm text-slate-600">
                            {customer.wooData.shipping.address_1 && (
                              <p>{customer.wooData.shipping.address_1}</p>
                            )}
                            {customer.wooData.shipping.address_2 && (
                              <p>{customer.wooData.shipping.address_2}</p>
                            )}
                            <p>
                              {[
                                customer.wooData.shipping.city,
                                customer.wooData.shipping.state,
                                customer.wooData.shipping.postcode,
                              ]
                                .filter(Boolean)
                                .join(", ")}
                            </p>
                            {customer.wooData.shipping.country && (
                              <p>{customer.wooData.shipping.country}</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <MapPin className="mx-auto h-10 w-10 text-slate-300" />
                      <p className="mt-2 text-slate-500">No addresses on file</p>
                    </div>
                  )}
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  );
}
