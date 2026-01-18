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
} from "lucide-react";
import type { Cin7Customer } from "@/lib/cin7";

const CIN7_BASE_URL = "https://inventory.dearsystems.com";

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Cin7Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 25;

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      params.set("page", String(page));
      params.set("limit", String(limit));

      const res = await fetch(`/api/cin7/customers?${params}`);
      const data = await res.json();

      if (res.ok) {
        setCustomers(data.customers || []);
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error("Failed to fetch customers:", error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, page]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchInput);
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

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-white px-6 py-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
          <p className="text-slate-500">
            View and search customers from Cin7
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Users className="h-3 w-3" />
            {total.toLocaleString()} customers
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-slate-50 p-6">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-4">
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
                      <TableHead>Last Updated</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.map((customer) => (
                      <TableRow
                        key={customer.ID}
                        className="cursor-pointer hover:bg-slate-50"
                        onClick={() => router.push(`/customers/${customer.ID}`)}
                      >
                        <TableCell className="font-medium">
                          {customer.Name}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const email = customer.Email || customer.Contacts?.[0]?.Email;
                            return email ? (
                              <span className="flex items-center gap-1 text-sm text-slate-600">
                                <Mail className="h-3 w-3" />
                                {email}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const phone = customer.Phone || customer.Contacts?.[0]?.Phone;
                            return phone ? (
                              <span className="flex items-center gap-1 text-sm text-slate-600">
                                <Phone className="h-3 w-3" />
                                {phone}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          {customer.LastModifiedOn ? (
                            <span className="text-sm text-slate-600">
                              {new Date(customer.LastModifiedOn).toLocaleDateString("en-AU")}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(customer.Status)}>
                            {customer.Status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(
                                `${CIN7_BASE_URL}/Customers/View?ID=${customer.ID}`,
                                "_blank"
                              );
                            }}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
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
