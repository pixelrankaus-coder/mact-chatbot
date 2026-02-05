"use client";

import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  RefreshCw,
} from "lucide-react";
import type { UnifiedOrder, UnifiedOrderItem, OrderSource, OrderStats } from "@/types/order";

const CIN7_BASE_URL = "https://inventory.dearsystems.com";
const WOO_BASE_URL = process.env.NEXT_PUBLIC_WOOCOMMERCE_URL || "https://mact.au";

// Source badge component
function SourceBadge({ source }: { source: "cin7" | "woocommerce" }) {
  if (source === "cin7") {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs font-medium">
        Cin7
      </Badge>
    );
  }
  return (
    <Badge className="bg-violet-100 text-violet-700 border-violet-200 text-xs font-medium">
      Woo
    </Badge>
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
      <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
        <TableCell colSpan={8} className="py-6">
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
      <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
        <TableCell colSpan={8} className="py-6">
          <p className="text-sm text-slate-500 text-center">No line items found for this order</p>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
      <TableCell colSpan={8} className="py-4 px-8">
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Order Items</h4>
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Product</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">SKU</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Qty</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Price</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="px-4 py-2.5 text-slate-900">{item.name || "-"}</td>
                    <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{item.sku || "-"}</td>
                    <td className="px-4 py-2.5 text-right text-slate-900">{item.quantity}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">${item.price?.toFixed(2) || "0.00"}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-slate-900">${item.total?.toFixed(2) || "0.00"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-slate-200 bg-slate-50">
                <tr>
                  <td colSpan={4} className="px-4 py-2.5 text-right text-sm font-medium text-slate-700">Order Total:</td>
                  <td className="px-4 py-2.5 text-right text-sm font-bold text-slate-900">${order.total.toFixed(2)}</td>
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

  const handleSourceChange = (source: string) => {
    setSourceFilter(source as OrderSource);
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
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "processing":
      case "picking":
      case "packed":
      case "approved":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "shipped":
        return "bg-violet-100 text-violet-700 border-violet-200";
      case "pending":
      case "on-hold":
      case "draft":
      case "ordering":
        return "bg-amber-100 text-amber-700 border-amber-200";
      case "backordered":
        return "bg-orange-100 text-orange-700 border-orange-200";
      case "cancelled":
      case "refunded":
      case "failed":
      case "void":
        return "bg-red-100 text-red-700 border-red-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
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
    <div className="flex h-full flex-col bg-slate-50">
      {/* Header */}
      <div className="border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Orders</h1>
            <p className="text-sm text-slate-500">
              Unified view from Cin7 and WooCommerce
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchOrders()}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="mt-4 grid grid-cols-4 gap-4">
          {/* Total Orders */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Orders</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">
                  {stats.total.toLocaleString()}
                </p>
              </div>
              <div className="rounded-full bg-slate-100 p-2">
                <Package className="h-5 w-5 text-slate-600" />
              </div>
            </div>
          </div>

          {/* Cin7 Orders */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Cin7</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">
                  {stats.cin7.toLocaleString()}
                </p>
                <p className="text-xs text-emerald-600">
                  {stats.total > 0 ? ((stats.cin7 / stats.total) * 100).toFixed(1) : 0}%
                </p>
              </div>
              <div className="rounded-full bg-emerald-100 p-2">
                <span className="flex h-5 w-5 items-center justify-center text-xs font-bold text-emerald-600">C7</span>
              </div>
            </div>
          </div>

          {/* WooCommerce Orders */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">WooCommerce</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">
                  {stats.woocommerce.toLocaleString()}
                </p>
                <p className="text-xs text-violet-600">
                  {stats.total > 0 ? ((stats.woocommerce / stats.total) * 100).toFixed(1) : 0}%
                </p>
              </div>
              <div className="rounded-full bg-violet-100 p-2">
                <span className="flex h-5 w-5 items-center justify-center text-xs font-bold text-violet-600">W</span>
              </div>
            </div>
          </div>

          {/* Current Page */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Showing</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">
                  {displayOrders.length}
                </p>
                <p className="text-xs text-slate-500">
                  of {total.toLocaleString()} results
                </p>
              </div>
              <div className="rounded-full bg-blue-100 p-2">
                <Search className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          {/* Card Header with Tabs and Search */}
          <div className="border-b border-slate-200 p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              {/* Tabs */}
              <Tabs value={sourceFilter} onValueChange={handleSourceChange} className="w-auto">
                <TabsList className="bg-slate-100">
                  <TabsTrigger value="all" className="gap-2 data-[state=active]:bg-white">
                    All
                    <Badge variant="secondary" className="ml-1 bg-slate-200 text-slate-700 text-xs">
                      {stats.total.toLocaleString()}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="cin7" className="gap-2 data-[state=active]:bg-white">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Cin7
                    <Badge variant="secondary" className="ml-1 bg-slate-200 text-slate-700 text-xs">
                      {stats.cin7.toLocaleString()}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="woocommerce" className="gap-2 data-[state=active]:bg-white">
                    <span className="h-2 w-2 rounded-full bg-violet-500" />
                    WooCommerce
                    <Badge variant="secondary" className="ml-1 bg-slate-200 text-slate-700 text-xs">
                      {stats.woocommerce.toLocaleString()}
                    </Badge>
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Search and Filters */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={hideVoided}
                    onCheckedChange={setHideVoided}
                    id="hide-voided"
                  />
                  <Label
                    htmlFor="hide-voided"
                    className="text-sm text-slate-600 cursor-pointer whitespace-nowrap"
                  >
                    Hide voided{voidedCount > 0 && ` (${voidedCount})`}
                  </Label>
                </div>
                <form onSubmit={handleSearch} className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      placeholder="Search by order #, customer..."
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      className="w-64 pl-9 bg-slate-50 border-slate-200 focus:bg-white"
                    />
                  </div>
                  <Button type="submit" size="default">
                    Search
                  </Button>
                </form>
              </div>
            </div>
          </div>

          {/* Table Content */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : displayOrders.length === 0 ? (
              <div className="py-16 text-center">
                <Package className="mx-auto h-12 w-12 text-slate-300" />
                <p className="mt-4 text-slate-500">
                  {searchQuery
                    ? "No orders found matching your search"
                    : "No orders found"}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                    <TableHead className="w-12"></TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Source</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Order #</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Date</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Customer</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Status</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Total</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-slate-100">
                  {displayOrders.map((order) => {
                    const isExpanded = expandedOrders.has(order.id);
                    const details = orderDetails[order.id];
                    const isLoadingDetails = loadingDetails.has(order.id);

                    return (
                      <Fragment key={order.id}>
                        <TableRow
                          className="cursor-pointer transition-colors hover:bg-slate-50"
                          onClick={() => router.push(`/orders/${order.id}`)}
                        >
                          <TableCell className="w-12">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600"
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
                          <TableCell className="font-medium text-slate-900">
                            {order.orderNumber}
                          </TableCell>
                          <TableCell>
                            <span className="flex items-center gap-1.5 text-sm text-slate-600">
                              <Calendar className="h-3.5 w-3.5 text-slate-400" />
                              {new Date(order.orderDate).toLocaleDateString("en-AU")}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm text-slate-900">
                                {order.customerName || "-"}
                              </p>
                              {order.customerEmail && (
                                <p className="text-xs text-slate-500 truncate max-w-[200px]">
                                  {order.customerEmail}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={`${getStatusColor(order.status)} text-xs font-medium`}>
                              {order.statusLabel}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold text-slate-900">
                            ${order.total.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            {getExternalUrl(order) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-slate-400 hover:text-blue-600"
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
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && !loading && (
            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
              <p className="text-sm text-slate-500">
                Showing <span className="font-medium text-slate-700">{(page - 1) * limit + 1}</span> to{" "}
                <span className="font-medium text-slate-700">{Math.min(page * limit, total)}</span> of{" "}
                <span className="font-medium text-slate-700">{total}</span> orders
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="gap-1"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
