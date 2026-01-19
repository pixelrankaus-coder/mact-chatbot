"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Search,
  Package,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Calendar,
} from "lucide-react";
import type { UnifiedOrder, UnifiedOrderItem, OrderSource, OrderStats } from "@/types/order";

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
      Woo
    </Badge>
  );
}

// Source filter component
function SourceFilter({
  value,
  onChange,
  stats,
}: {
  value: OrderSource;
  onChange: (source: OrderSource) => void;
  stats: OrderStats;
}) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <Button
        variant={value === "all" ? "default" : "outline"}
        size="sm"
        onClick={() => onChange("all")}
      >
        All ({stats.total.toLocaleString()})
      </Button>
      <Button
        variant={value === "cin7" ? "default" : "outline"}
        size="sm"
        onClick={() => onChange("cin7")}
        className="gap-2"
      >
        <span className="w-2 h-2 rounded-full bg-green-500" />
        Cin7 ({stats.cin7.toLocaleString()})
      </Button>
      <Button
        variant={value === "woocommerce" ? "default" : "outline"}
        size="sm"
        onClick={() => onChange("woocommerce")}
        className="gap-2"
      >
        <span className="w-2 h-2 rounded-full bg-purple-500" />
        WooCommerce ({stats.woocommerce.toLocaleString()})
      </Button>
    </div>
  );
}

// Expanded row component to show line items
function ExpandedOrderRow({
  order,
  items,
  loading,
}: {
  order: UnifiedOrder;
  items: UnifiedOrderItem[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <TableRow className="bg-slate-50">
        <TableCell colSpan={8} className="py-4">
          <div className="flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600 mr-2" />
            <span className="text-sm text-slate-500">Loading order details...</span>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  if (items.length === 0) {
    return (
      <TableRow className="bg-slate-50">
        <TableCell colSpan={8} className="py-4">
          <p className="text-sm text-slate-500 text-center">No line items found for this order</p>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow className="bg-slate-50">
      <TableCell colSpan={8} className="py-4 px-8">
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-700 mb-3">Order Items</h4>
          <div className="rounded-lg border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-slate-600">Product</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-600">SKU</th>
                  <th className="px-4 py-2 text-right font-medium text-slate-600">Qty</th>
                  <th className="px-4 py-2 text-right font-medium text-slate-600">Price</th>
                  <th className="px-4 py-2 text-right font-medium text-slate-600">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} className="border-t border-slate-100">
                    <td className="px-4 py-2 text-slate-800">{item.name || "-"}</td>
                    <td className="px-4 py-2 text-slate-500">{item.sku || "-"}</td>
                    <td className="px-4 py-2 text-right text-slate-800">{item.quantity}</td>
                    <td className="px-4 py-2 text-right text-slate-600">${item.price?.toFixed(2) || "0.00"}</td>
                    <td className="px-4 py-2 text-right font-medium text-slate-800">${item.total?.toFixed(2) || "0.00"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-slate-200 bg-slate-50">
                <tr>
                  <td colSpan={4} className="px-4 py-2 text-right font-medium text-slate-700">Order Total:</td>
                  <td className="px-4 py-2 text-right font-bold text-slate-900">${order.total.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<UnifiedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [sourceFilter, setSourceFilter] = useState<OrderSource>("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<OrderStats>({
    cin7: 0,
    woocommerce: 0,
    total: 0,
  });
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [orderDetails, setOrderDetails] = useState<Record<string, UnifiedOrder>>({});
  const [loadingDetails, setLoadingDetails] = useState<Set<string>>(new Set());
  const [hideVoided, setHideVoided] = useState(true);
  const limit = 25;

  // Filter out voided orders and count them
  const { displayOrders, voidedCount } = useMemo(() => {
    const voided = orders.filter(
      (o) =>
        o.status?.toUpperCase() === "VOIDED" ||
        o.statusLabel?.toUpperCase() === "VOIDED"
    );
    const nonVoided = orders.filter(
      (o) =>
        o.status?.toUpperCase() !== "VOIDED" &&
        o.statusLabel?.toUpperCase() !== "VOIDED"
    );
    return {
      displayOrders: hideVoided ? nonVoided : orders,
      voidedCount: voided.length,
    };
  }, [orders, hideVoided]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (sourceFilter !== "all") params.set("source", sourceFilter);
      params.set("page", String(page));
      params.set("limit", String(limit));

      const res = await fetch(`/api/orders?${params}`);
      const data = await res.json();

      if (res.ok) {
        setOrders(data.orders || []);
        setTotal(data.total || 0);
        if (data.stats) {
          setStats(data.stats);
        }
      }
    } catch (error) {
      console.error("Failed to fetch orders:", error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, sourceFilter, page]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchInput);
    setPage(1);
  };

  const handleSourceChange = (source: OrderSource) => {
    setSourceFilter(source);
    setPage(1);
  };

  const toggleExpanded = async (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    const newExpanded = new Set(expandedOrders);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);

      // Fetch order details if not already loaded
      if (!orderDetails[orderId]) {
        setLoadingDetails((prev) => new Set(prev).add(orderId));
        try {
          const res = await fetch(`/api/orders/${orderId}`);
          if (res.ok) {
            const data = await res.json();
            setOrderDetails((prev) => ({ ...prev, [orderId]: data.order }));
          }
        } catch (error) {
          console.error("Failed to fetch order details:", error);
        } finally {
          setLoadingDetails((prev) => {
            const next = new Set(prev);
            next.delete(orderId);
            return next;
          });
        }
      }
    }
    setExpandedOrders(newExpanded);
  };

  const totalPages = Math.ceil(total / limit);

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
  const getExternalUrl = (order: UnifiedOrder) => {
    if (order.source === "cin7" && order.cin7Id) {
      return `${CIN7_BASE_URL}/Sale/SaleOrder?ID=${order.cin7Id}`;
    }
    if (order.source === "woocommerce" && order.wooId) {
      return `${WOO_BASE_URL}/wp-admin/post.php?post=${order.wooId}&action=edit`;
    }
    return null;
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-white px-6 py-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Orders</h1>
          <p className="text-slate-500">
            Unified view from Cin7 and WooCommerce
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Package className="h-3 w-3" />
            {stats.total.toLocaleString()} orders
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-slate-50 p-6">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Package className="h-5 w-5 text-blue-600" />
                  Order History
                </CardTitle>
                <form onSubmit={handleSearch} className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      placeholder="Search by order #, customer..."
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      className="w-80 pl-9"
                    />
                  </div>
                  <Button type="submit">Search</Button>
                </form>
              </div>
              <div className="flex items-center justify-between">
                <SourceFilter
                  value={sourceFilter}
                  onChange={handleSourceChange}
                  stats={stats}
                />
                <div className="flex items-center gap-2">
                  <Switch
                    checked={hideVoided}
                    onCheckedChange={setHideVoided}
                    id="hide-voided"
                  />
                  <Label
                    htmlFor="hide-voided"
                    className="text-sm text-slate-600 cursor-pointer"
                  >
                    Hide voided{voidedCount > 0 && ` (${voidedCount})`}
                  </Label>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : displayOrders.length === 0 ? (
              <div className="py-12 text-center">
                <Package className="mx-auto h-12 w-12 text-slate-300" />
                <p className="mt-4 text-slate-500">
                  {searchQuery
                    ? "No orders found matching your search"
                    : "No orders found"}
                </p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Order #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayOrders.map((order) => {
                      const isExpanded = expandedOrders.has(order.id);
                      const details = orderDetails[order.id];
                      const isLoadingDetails = loadingDetails.has(order.id);

                      return (
                        <>
                          <TableRow
                            key={order.id}
                            className="cursor-pointer hover:bg-slate-50"
                            onClick={() => router.push(`/orders/${order.id}`)}
                          >
                            <TableCell className="w-10">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={(e) => toggleExpanded(order.id, e)}
                              >
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                            </TableCell>
                            <TableCell>
                              <SourceBadge source={order.source} />
                            </TableCell>
                            <TableCell className="font-medium">
                              {order.orderNumber}
                            </TableCell>
                            <TableCell>
                              <span className="flex items-center gap-1 text-sm text-slate-600">
                                <Calendar className="h-3 w-3" />
                                {new Date(order.orderDate).toLocaleDateString("en-AU")}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium text-sm">
                                  {order.customerName || "-"}
                                </p>
                                {order.customerEmail && (
                                  <p className="text-xs text-slate-500">
                                    {order.customerEmail}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={getStatusColor(order.status)}>
                                {order.statusLabel}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              ${order.total.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              {getExternalUrl(order) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const url = getExternalUrl(order);
                                    if (url) window.open(url, "_blank");
                                  }}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                          {isExpanded && (
                            <ExpandedOrderRow
                              key={`${order.id}-expanded`}
                              order={details || order}
                              items={details?.items || []}
                              loading={isLoadingDetails}
                            />
                          )}
                        </>
                      );
                    })}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-sm text-slate-500">
                      Showing {(page - 1) * limit + 1} to{" "}
                      {Math.min(page * limit, total)} of {total} orders
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
