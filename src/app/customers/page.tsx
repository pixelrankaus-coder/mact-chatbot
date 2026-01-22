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
  Users,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
  ExternalLink,
  ShoppingCart,
  DollarSign,
  Calendar,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Crown,
  TrendingUp,
  Clock,
  Sparkles,
  AtSign,
  Send,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import type { UnifiedCustomer, CustomerSource, CustomerStats } from "@/types/customer";

const CIN7_BASE_URL = "https://inventory.dearsystems.com";
const WOO_BASE_URL = process.env.NEXT_PUBLIC_WOOCOMMERCE_URL || "https://mact.au";

// Segment type
type Segment = "all" | "vip" | "active" | "dormant" | "new" | "marketable";

// Extended stats with segments
interface ExtendedStats extends CustomerStats {
  segments?: {
    all: number;
    vip: number;
    active: number;
    dormant: number;
    new: number;
    marketable: number;
  };
}

// Sort configuration
type SortField = "name" | "total_orders" | "total_spent" | "last_order_date";
type SortDir = "asc" | "desc";

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
          Woo
        </Badge>
      )}
    </div>
  );
}

// Customer tier badge component
function TierBadge({ totalOrders, totalSpent }: { totalOrders: number; totalSpent: number }) {
  if (totalOrders >= 10 || totalSpent >= 10000) {
    return (
      <span title="Gold Tier: 10+ orders or $10K+ spent" className="text-lg">
        🥇
      </span>
    );
  }
  if (totalOrders >= 5 || totalSpent >= 5000) {
    return (
      <span title="Silver Tier: 5+ orders or $5K+ spent" className="text-lg">
        🥈
      </span>
    );
  }
  if (totalOrders >= 2 || totalSpent >= 1000) {
    return (
      <span title="Bronze Tier: 2+ orders or $1K+ spent" className="text-lg">
        🥉
      </span>
    );
  }
  return null;
}

// Activity status dot component
function ActivityDot({ lastOrderDate }: { lastOrderDate: string | null }) {
  if (!lastOrderDate) {
    return (
      <span
        className="inline-block w-2 h-2 rounded-full bg-gray-300"
        title="No orders"
      />
    );
  }

  const lastOrder = new Date(lastOrderDate);
  const now = new Date();
  const daysSince = Math.floor((now.getTime() - lastOrder.getTime()) / (1000 * 60 * 60 * 24));

  if (daysSince <= 30) {
    return (
      <span
        className="inline-block w-2 h-2 rounded-full bg-green-500"
        title={`Active: ordered ${daysSince} days ago`}
      />
    );
  }
  if (daysSince <= 180) {
    return (
      <span
        className="inline-block w-2 h-2 rounded-full bg-yellow-500"
        title={`Moderate: ordered ${daysSince} days ago`}
      />
    );
  }
  return (
    <span
      className="inline-block w-2 h-2 rounded-full bg-red-500"
      title={`Inactive: ordered ${daysSince} days ago`}
    />
  );
}

// Source filter component
function SourceFilter({
  value,
  onChange,
  stats,
}: {
  value: CustomerSource;
  onChange: (source: CustomerSource) => void;
  stats: CustomerStats;
}) {
  return (
    <div className="flex flex-wrap gap-2">
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
        Cin7 Only ({stats.cin7Only.toLocaleString()})
      </Button>
      <Button
        variant={value === "woocommerce" ? "default" : "outline"}
        size="sm"
        onClick={() => onChange("woocommerce")}
        className="gap-2"
      >
        <span className="w-2 h-2 rounded-full bg-purple-500" />
        Woo Only ({stats.wooOnly.toLocaleString()})
      </Button>
      <Button
        variant={value === "both" ? "default" : "outline"}
        size="sm"
        onClick={() => onChange("both")}
        className="gap-2"
      >
        <span className="flex">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          <span className="w-2 h-2 rounded-full bg-purple-500 -ml-1" />
        </span>
        Both ({stats.both.toLocaleString()})
      </Button>
    </div>
  );
}

// Klaviyo sync status
interface KlaviyoSyncStatus {
  syncing: boolean;
  progress?: {
    total: number;
    processed: number;
    succeeded: number;
    failed: number;
    currentCustomer?: string;
  };
  result?: {
    total: number;
    succeeded: number;
    failed: number;
    message: string;
  };
  error?: string;
}

// Segment tabs component
function SegmentTabs({
  value,
  onChange,
  stats,
  onSyncToKlaviyo,
  klaviyoStatus,
}: {
  value: Segment;
  onChange: (segment: Segment) => void;
  stats: ExtendedStats;
  onSyncToKlaviyo?: () => void;
  klaviyoStatus?: KlaviyoSyncStatus;
}) {
  const segments = stats.segments || { all: 0, vip: 0, active: 0, dormant: 0, new: 0, marketable: 0 };

  return (
    <div className="flex flex-wrap items-center gap-2 border-b pb-4">
      <Button
        variant={value === "all" ? "default" : "ghost"}
        size="sm"
        onClick={() => onChange("all")}
        className="gap-2"
      >
        <Users className="h-4 w-4" />
        All ({segments.all.toLocaleString()})
      </Button>
      <Button
        variant={value === "vip" ? "default" : "ghost"}
        size="sm"
        onClick={() => onChange("vip")}
        className="gap-2"
      >
        <Crown className="h-4 w-4 text-yellow-500" />
        VIP ({segments.vip.toLocaleString()})
      </Button>
      <Button
        variant={value === "active" ? "default" : "ghost"}
        size="sm"
        onClick={() => onChange("active")}
        className="gap-2"
      >
        <TrendingUp className="h-4 w-4 text-green-500" />
        Active ({segments.active.toLocaleString()})
      </Button>
      <Button
        variant={value === "dormant" ? "default" : "ghost"}
        size="sm"
        onClick={() => onChange("dormant")}
        className="gap-2"
      >
        <Clock className="h-4 w-4 text-red-500" />
        Dormant ({segments.dormant.toLocaleString()})
      </Button>
      <Button
        variant={value === "new" ? "default" : "ghost"}
        size="sm"
        onClick={() => onChange("new")}
        className="gap-2"
      >
        <Sparkles className="h-4 w-4 text-blue-500" />
        New ({segments.new.toLocaleString()})
      </Button>
      <Button
        variant={value === "marketable" ? "default" : "ghost"}
        size="sm"
        onClick={() => onChange("marketable")}
        className="gap-2"
      >
        <AtSign className="h-4 w-4 text-purple-500" />
        Marketable ({segments.marketable.toLocaleString()})
      </Button>

      {/* Sync to Klaviyo button - only visible on Dormant segment */}
      {value === "dormant" && onSyncToKlaviyo && (
        <div className="ml-auto flex items-center gap-2">
          {klaviyoStatus?.syncing && klaviyoStatus.progress && (
            <span className="text-sm text-slate-500">
              {klaviyoStatus.progress.processed} / {klaviyoStatus.progress.total}
              {klaviyoStatus.progress.currentCustomer && (
                <span className="ml-1 text-slate-400">
                  ({klaviyoStatus.progress.currentCustomer})
                </span>
              )}
            </span>
          )}
          {klaviyoStatus?.result && !klaviyoStatus.syncing && (
            <span className="flex items-center gap-1 text-sm">
              {klaviyoStatus.result.failed === 0 ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-green-600">
                    {klaviyoStatus.result.succeeded} synced
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                  <span className="text-yellow-600">
                    {klaviyoStatus.result.succeeded} synced, {klaviyoStatus.result.failed} failed
                  </span>
                </>
              )}
            </span>
          )}
          {klaviyoStatus?.error && (
            <span className="flex items-center gap-1 text-sm text-red-600">
              <AlertCircle className="h-4 w-4" />
              {klaviyoStatus.error}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onSyncToKlaviyo}
            disabled={klaviyoStatus?.syncing}
            className="gap-2 border-pink-200 bg-pink-50 text-pink-700 hover:bg-pink-100"
          >
            {klaviyoStatus?.syncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Sync to Klaviyo
          </Button>
        </div>
      )}
    </div>
  );
}

// Summary stats cards component
function SummaryStats({ stats }: { stats: ExtendedStats }) {
  const segments = stats.segments || { all: 0, vip: 0, active: 0, dormant: 0, new: 0, marketable: 0 };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
      <Card className="border shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-xs text-slate-500">Total Customers</p>
              <p className="text-xl font-bold">{segments.all.toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="border shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-500" />
            <div>
              <p className="text-xs text-slate-500">VIP Customers</p>
              <p className="text-xl font-bold">{segments.vip.toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="border shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-xs text-slate-500">Active</p>
              <p className="text-xl font-bold">{segments.active.toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="border shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-red-500" />
            <div>
              <p className="text-xs text-slate-500">Dormant</p>
              <p className="text-xl font-bold">{segments.dormant.toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="border shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-xs text-slate-500">New (30 days)</p>
              <p className="text-xl font-bold">{segments.new.toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="border shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <AtSign className="h-5 w-5 text-purple-500" />
            <div>
              <p className="text-xs text-slate-500">Marketable</p>
              <p className="text-xl font-bold">{segments.marketable.toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Sortable column header component
function SortableHeader({
  label,
  field,
  currentSort,
  currentDir,
  onSort,
  icon: Icon,
}: {
  label: string;
  field: SortField;
  currentSort: SortField;
  currentDir: SortDir;
  onSort: (field: SortField) => void;
  icon?: React.ElementType;
}) {
  const isActive = currentSort === field;

  return (
    <button
      className="flex items-center gap-1 hover:text-blue-600 transition-colors font-medium"
      onClick={() => onSort(field)}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {label}
      {isActive ? (
        currentDir === "asc" ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 text-slate-300" />
      )}
    </button>
  );
}

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<UnifiedCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [sourceFilter, setSourceFilter] = useState<CustomerSource>("all");
  const [segment, setSegment] = useState<Segment>("all");
  const [sortBy, setSortBy] = useState<SortField>("total_spent");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<ExtendedStats>({
    cin7Only: 0,
    wooOnly: 0,
    both: 0,
    total: 0,
    segments: { all: 0, vip: 0, active: 0, dormant: 0, new: 0, marketable: 0 },
  });
  const [klaviyoStatus, setKlaviyoStatus] = useState<KlaviyoSyncStatus>({
    syncing: false,
  });
  const limit = 50;

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (sourceFilter !== "all") params.set("source", sourceFilter);
      if (segment !== "all") params.set("segment", segment);
      params.set("sortBy", sortBy);
      params.set("sortDir", sortDir);
      params.set("page", String(page));
      params.set("limit", String(limit));

      const res = await fetch(`/api/customers?${params}`);
      const data = await res.json();

      if (res.ok) {
        setCustomers(data.customers || []);
        setTotal(data.total || 0);
        if (data.stats) {
          setStats(data.stats);
        }
      }
    } catch (error) {
      console.error("Failed to fetch customers:", error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, sourceFilter, segment, sortBy, sortDir, page]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchInput);
    setPage(1);
  };

  const handleSourceChange = (source: CustomerSource) => {
    setSourceFilter(source);
    setPage(1);
  };

  const handleSegmentChange = (newSegment: Segment) => {
    setSegment(newSegment);
    setPage(1);
  };

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortDir("desc");
    }
    setPage(1);
  };

  // Handle Klaviyo sync for dormant customers
  const handleSyncToKlaviyo = useCallback(async () => {
    setKlaviyoStatus({ syncing: true });

    try {
      const response = await fetch("/api/klaviyo/sync-dormant", {
        method: "POST",
        headers: {
          Accept: "text/event-stream",
        },
      });

      if (!response.ok) {
        const error = await response.json();
        setKlaviyoStatus({
          syncing: false,
          error: error.error || "Sync failed",
        });
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setKlaviyoStatus({ syncing: false, error: "No response stream" });
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let currentEvent = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ") && currentEvent) {
            try {
              const data = JSON.parse(line.slice(6));

              if (currentEvent === "progress") {
                setKlaviyoStatus({
                  syncing: true,
                  progress: data,
                });
              } else if (currentEvent === "complete") {
                setKlaviyoStatus({
                  syncing: false,
                  result: data,
                });
              } else if (currentEvent === "error") {
                setKlaviyoStatus({
                  syncing: false,
                  error: data.message,
                });
              } else if (currentEvent === "status") {
                // Status messages don't need UI update, just log
                console.log("[Klaviyo Sync]", data.message);
              }
            } catch {
              // Ignore parse errors
            }
            currentEvent = ""; // Reset after processing
          }
        }
      }
    } catch (error) {
      setKlaviyoStatus({
        syncing: false,
        error: error instanceof Error ? error.message : "Sync failed",
      });
    }
  }, []);

  const totalPages = Math.ceil(total / limit);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Format date
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Build detail page URL based on customer source
  const getCustomerUrl = (customer: UnifiedCustomer) => {
    // Prefer Cin7 ID if available
    if (customer.cin7Id) {
      return `/customers/${customer.cin7Id}`;
    }
    // Fallback to WooCommerce ID with woo- prefix
    if (customer.wooId) {
      return `/customers/woo-${customer.wooId}`;
    }
    return `/customers/${customer.id}`;
  };

  // Get external link URL
  const getExternalUrl = (customer: UnifiedCustomer) => {
    if (customer.cin7Id) {
      return `${CIN7_BASE_URL}/Customers/View?ID=${customer.cin7Id}`;
    }
    if (customer.wooId) {
      return `${WOO_BASE_URL}/wp-admin/user-edit.php?user_id=${customer.wooId}`;
    }
    return null;
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-white px-6 py-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
          <p className="text-slate-500">
            Unified view from Cin7 and WooCommerce
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Users className="h-3 w-3" />
            {stats.total.toLocaleString()} customers
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-slate-50 p-6">
        {/* Summary Stats */}
        <SummaryStats stats={stats} />

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5 text-blue-600" />
                  Customer Directory
                </CardTitle>
                <form onSubmit={handleSearch} className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      placeholder="Search by name, email, phone..."
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      className="w-80 pl-9"
                    />
                  </div>
                  <Button type="submit">Search</Button>
                </form>
              </div>

              {/* Segment Tabs */}
              <SegmentTabs
                value={segment}
                onChange={handleSegmentChange}
                stats={stats}
                onSyncToKlaviyo={handleSyncToKlaviyo}
                klaviyoStatus={klaviyoStatus}
              />

              {/* Source Filter */}
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
            ) : customers.length === 0 ? (
              <div className="py-12 text-center">
                <Users className="mx-auto h-12 w-12 text-slate-300" />
                <p className="mt-4 text-slate-500">
                  {searchQuery
                    ? "No customers found matching your search"
                    : "No customers found"}
                </p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <SortableHeader
                          label="Name"
                          field="name"
                          currentSort={sortBy}
                          currentDir={sortDir}
                          onSort={handleSort}
                        />
                      </TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Sources</TableHead>
                      <TableHead>
                        <SortableHeader
                          label="Orders"
                          field="total_orders"
                          currentSort={sortBy}
                          currentDir={sortDir}
                          onSort={handleSort}
                          icon={ShoppingCart}
                        />
                      </TableHead>
                      <TableHead>
                        <SortableHeader
                          label="Total Spent"
                          field="total_spent"
                          currentSort={sortBy}
                          currentDir={sortDir}
                          onSort={handleSort}
                          icon={DollarSign}
                        />
                      </TableHead>
                      <TableHead>
                        <SortableHeader
                          label="Last Order"
                          field="last_order_date"
                          currentSort={sortBy}
                          currentDir={sortDir}
                          onSort={handleSort}
                          icon={Calendar}
                        />
                      </TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.map((customer) => (
                      <TableRow
                        key={customer.id}
                        className="cursor-pointer hover:bg-slate-50"
                        onClick={() => router.push(getCustomerUrl(customer))}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <ActivityDot lastOrderDate={customer.lastOrderDate || null} />
                            {customer.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          {customer.email ? (
                            <span className="flex items-center gap-1 text-sm text-slate-600">
                              <Mail className="h-3 w-3" />
                              {customer.email}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <SourceBadges sources={customer.sources} />
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1 text-sm text-slate-600">
                            <ShoppingCart className="h-3 w-3" />
                            {customer.totalOrders || 0}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1 text-sm font-medium text-slate-700">
                            {formatCurrency(customer.totalSpent || 0)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-slate-600">
                            {formatDate(customer.lastOrderDate || null)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <TierBadge
                            totalOrders={customer.totalOrders || 0}
                            totalSpent={customer.totalSpent || 0}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          {getExternalUrl(customer) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(getExternalUrl(customer), "_blank");
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
                      {Math.min(page * limit, total)} of {total} customers
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
