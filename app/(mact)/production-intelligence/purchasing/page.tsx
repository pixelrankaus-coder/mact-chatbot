"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Clock,
  DollarSign,
  Package,
  RefreshCw,
  Loader2,
  Play,
  ArrowRight,
  Search,
  AlertCircle,
  X,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";

// ─── Types ──────────────────────────────────────────────────────────────────

interface MaterialSummary {
  component_sku_id: string;
  component_name: string;
  supplier_name: string | null;
  current_stock: number;
  total_required: number;
  total_shortfall: number;
  total_order_qty: number;
  total_estimated_cost: number;
  earliest_order_by: string | null;
  worst_urgency: string;
  has_supplier_config: boolean;
  supplier_id: string | null;
}

interface MRPData {
  summary: {
    total_materials: number;
    overdue: number;
    urgent: number;
    upcoming: number;
    total_estimated_cost: number;
  };
  materials: MaterialSummary[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function urgencyBadge(flag: string) {
  switch (flag) {
    case "OVERDUE":
      return <Badge variant="destructive" className="text-xs">Overdue</Badge>;
    case "URGENT":
      return <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-xs">Urgent</Badge>;
    case "UPCOMING":
      return <Badge className="bg-yellow-400 hover:bg-yellow-500 text-yellow-900 text-xs">Upcoming</Badge>;
    default:
      return <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">OK</Badge>;
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function formatCurrency(amount: number | null): string {
  if (!amount) return "—";
  return `$${amount.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function PurchasingPlannerPage() {
  const [data, setData] = useState<MRPData | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [groupBySupplier, setGroupBySupplier] = useState(false);
  const [dismissedBanner, setDismissedBanner] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const filterParam = filter === "all" ? "" : `?filter=${filter}`;
      const res = await fetch(`/api/production-intelligence/mrp${filterParam}`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const runMRP = async () => {
    setRunning(true);
    try {
      await fetch("/api/production-intelligence/mrp/run", { method: "POST" });
      await fetchData();
    } catch {
      // ignore
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const summary = data?.summary;
  const materials = data?.materials || [];

  // Apply search filter
  const filtered = materials.filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      m.component_name.toLowerCase().includes(q) ||
      m.component_sku_id.toLowerCase().includes(q)
    );
  });

  // Group by supplier
  const grouped = groupBySupplier
    ? filtered.reduce((acc, m) => {
        const key = m.supplier_name || "No supplier configured";
        if (!acc[key]) acc[key] = [];
        acc[key].push(m);
        return acc;
      }, {} as Record<string, MaterialSummary[]>)
    : { "": filtered };

  const overdueCount = summary?.overdue || 0;

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Overdue Alert Banner */}
        {overdueCount > 0 && !dismissedBanner && (
          <div
            className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between cursor-pointer"
            onClick={() => setFilter("overdue")}
          >
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <span className="text-red-800 font-medium">
                {overdueCount} material{overdueCount > 1 ? "s have" : " has"} passed their order-by date. Immediate action required.
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-red-400 hover:text-red-600"
              onClick={(e) => {
                e.stopPropagation();
                setDismissedBanner(true);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Purchasing Planner
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Material requirements &amp; order deadlines — 12-week outlook
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={runMRP}
              disabled={running}
            >
              {running ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              {running ? "Running..." : "Run MRP"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Loading */}
        {loading && !data ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading purchasing data...
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Overdue Orders
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${(summary?.overdue || 0) > 0 ? "text-red-600" : "text-green-600"}`}>
                    {summary?.overdue || 0}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Order This Week
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${(summary?.urgent || 0) > 0 ? "text-amber-600" : "text-green-600"}`}>
                    {summary?.urgent || 0}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5" />
                    Upcoming (7–14d)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-600">
                    {summary?.upcoming || 0}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5" />
                    Est. PO Value
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(summary?.total_estimated_cost || 0)}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3">
              <ToggleGroup
                type="single"
                value={filter}
                onValueChange={(v) => v && setFilter(v)}
                className="justify-start"
              >
                <ToggleGroupItem value="all" className="text-xs">All</ToggleGroupItem>
                <ToggleGroupItem value="shortfalls" className="text-xs">Shortfalls</ToggleGroupItem>
                <ToggleGroupItem value="overdue" className="text-xs">Overdue</ToggleGroupItem>
                <ToggleGroupItem value="urgent" className="text-xs">Urgent</ToggleGroupItem>
                <ToggleGroupItem value="upcoming" className="text-xs">Upcoming</ToggleGroupItem>
              </ToggleGroup>

              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search material or SKU..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Button
                variant={groupBySupplier ? "default" : "outline"}
                size="sm"
                onClick={() => setGroupBySupplier(!groupBySupplier)}
              >
                <Users className="h-4 w-4 mr-2" />
                Group by Supplier
              </Button>
            </div>

            {/* Materials Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Materials Requirements
                </CardTitle>
                <CardDescription>
                  {filtered.length} material{filtered.length !== 1 ? "s" : ""} — sorted by urgency
                </CardDescription>
              </CardHeader>
              <CardContent>
                {filtered.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No material requirements found.</p>
                    <p className="text-xs mt-1">Run MRP engine first, then refresh.</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {Object.entries(grouped).map(([group, items]) => (
                      <div key={group}>
                        {groupBySupplier && group && (
                          <div className="px-4 py-2 mt-3 mb-1 bg-muted/50 rounded text-sm font-medium text-muted-foreground">
                            {group} ({items.length})
                          </div>
                        )}

                        {/* Table Header */}
                        <div className="grid grid-cols-[1fr_90px_90px_90px_90px_100px_80px_80px_32px] gap-2 px-4 py-2 text-xs font-medium text-muted-foreground border-b">
                          <div>Material</div>
                          <div className="text-right">Stock</div>
                          <div className="text-right">Required</div>
                          <div className="text-right">Shortfall</div>
                          <div className="text-right">Order Qty</div>
                          <div className="text-center">Order By</div>
                          <div className="text-right">Est. Cost</div>
                          <div className="text-center">Status</div>
                          <div />
                        </div>

                        {items.map((m) => (
                          <Link
                            key={m.component_sku_id}
                            href={`/production-intelligence/purchasing/${m.component_sku_id}`}
                            className="grid grid-cols-[1fr_90px_90px_90px_90px_100px_80px_80px_32px] gap-2 px-4 py-3 rounded-lg border hover:bg-accent/50 transition-colors items-center"
                          >
                            <div>
                              <div className="font-medium text-sm truncate flex items-center gap-1.5">
                                {m.component_name}
                                {!m.has_supplier_config && (
                                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" title="No supplier configured — using 14-day default lead time" />
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {m.component_sku_id}
                                {m.supplier_name && !groupBySupplier && (
                                  <span className="ml-2 text-blue-600">· {m.supplier_name}</span>
                                )}
                              </div>
                            </div>
                            <div className="text-right font-mono text-sm">
                              {Math.round(m.current_stock)}
                            </div>
                            <div className="text-right font-mono text-sm">
                              {Math.round(m.total_required)}
                            </div>
                            <div className={`text-right font-mono text-sm font-bold ${m.total_shortfall > 0 ? "text-red-600" : ""}`}>
                              {m.total_shortfall > 0 ? Math.round(m.total_shortfall) : "—"}
                            </div>
                            <div className="text-right font-mono text-sm">
                              {m.total_order_qty > 0 ? Math.round(m.total_order_qty) : "—"}
                            </div>
                            <div className={`text-center text-xs ${
                              m.worst_urgency === "OVERDUE" ? "text-red-600 font-bold" :
                              m.worst_urgency === "URGENT" ? "text-amber-600 font-medium" : ""
                            }`}>
                              {formatDate(m.earliest_order_by)}
                            </div>
                            <div className="text-right text-sm">
                              {formatCurrency(m.total_estimated_cost)}
                            </div>
                            <div className="flex justify-center">
                              {urgencyBadge(m.worst_urgency)}
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          </Link>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
