"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  ExternalLink,
  Calendar,
} from "lucide-react";
import type { UnifiedOrder, OrderSource, OrderStats } from "@/types/order";

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
  const limit = 25;

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
              <SourceFilter
                value={sourceFilter}
                onChange={handleSourceChange}
                stats={stats}
              />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : orders.length === 0 ? (
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
                    {orders.map((order) => (
                      <TableRow
                        key={order.id}
                        className="cursor-pointer hover:bg-slate-50"
                        onClick={() => router.push(`/orders/${order.id}`)}
                      >
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
                                window.open(getExternalUrl(order), "_blank");
                              }}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
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
