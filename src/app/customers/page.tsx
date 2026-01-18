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
} from "lucide-react";
import type { UnifiedCustomer, CustomerSource, CustomerStats } from "@/types/customer";

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
          Woo
        </Badge>
      )}
    </div>
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

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<UnifiedCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [sourceFilter, setSourceFilter] = useState<CustomerSource>("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<CustomerStats>({
    cin7Only: 0,
    wooOnly: 0,
    both: 0,
    total: 0,
  });
  const limit = 50;

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (sourceFilter !== "all") params.set("source", sourceFilter);
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
  }, [searchQuery, sourceFilter, page]);

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

  const totalPages = Math.ceil(total / limit);

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "active":
        return "bg-green-100 text-green-700";
      case "inactive":
        return "bg-gray-100 text-gray-700";
      case "hold":
        return "bg-yellow-100 text-yellow-700";
      default:
        return "bg-blue-100 text-blue-700";
    }
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
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Sources</TableHead>
                      <TableHead>Orders</TableHead>
                      <TableHead>Status</TableHead>
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
                          {customer.name}
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
                          {customer.phone ? (
                            <span className="flex items-center gap-1 text-sm text-slate-600">
                              <Phone className="h-3 w-3" />
                              {customer.phone}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <SourceBadges sources={customer.sources} />
                        </TableCell>
                        <TableCell>
                          {customer.totalOrders !== undefined ? (
                            <span className="flex items-center gap-1 text-sm text-slate-600">
                              <ShoppingCart className="h-3 w-3" />
                              {customer.totalOrders}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(customer.status)}>
                            {customer.status}
                          </Badge>
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
