"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  RefreshCw,
  Loader2,
  Package,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
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
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

// ─── Types ──────────────────────────────────────────────────────────────────

interface WeekRequirement {
  week_start: string;
  required_qty: number;
  available_qty: number;
  shortfall_qty: number;
  order_qty: number;
  order_by_date: string | null;
  urgency_flag: string;
  estimated_cost: number | null;
}

interface FinishedGood {
  sku_id: string;
  name: string;
  sku_code: string;
  qty_per_batch: number;
  std_batch_size: number;
}

interface MaterialDetail {
  component_sku_id: string;
  component_name: string;
  current_stock: number;
  moq: number | null;
  order_multiple: number | null;
  lead_time_days: number;
  unit_cost: number | null;
  urgency_flag: string;
  supplier: { id: string; name: string; contact_name?: string; email?: string; phone?: string } | null;
  has_supplier_config: boolean;
  weeks: WeekRequirement[];
  finished_goods: FinishedGood[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatWeek(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function urgencyBadge(flag: string) {
  switch (flag) {
    case "OVERDUE":
      return <Badge variant="destructive">Overdue</Badge>;
    case "URGENT":
      return <Badge className="bg-amber-500 hover:bg-amber-600 text-white">Urgent</Badge>;
    case "UPCOMING":
      return <Badge className="bg-yellow-400 hover:bg-yellow-500 text-yellow-900">Upcoming</Badge>;
    default:
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">OK</Badge>;
  }
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function MaterialDetailPage() {
  const params = useParams();
  const componentSkuId = params.componentSkuId as string;

  const [data, setData] = useState<MaterialDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFinishedGoods, setShowFinishedGoods] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/production-intelligence/mrp/${componentSkuId}`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [componentSkuId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading material data...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Material not found or no MRP data available.
      </div>
    );
  }

  // Chart data
  const chartData = data.weeks.map((w) => ({
    week: formatWeek(w.week_start),
    required: Math.round(w.required_qty),
    available: Math.round(w.available_qty),
    shortfall: Math.round(w.shortfall_qty),
  }));

  // Find the order-by date week for annotation
  const orderByWeek = data.weeks.find((w) => w.order_by_date && w.shortfall_qty > 0);

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/production-intelligence/purchasing">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">{data.component_name}</h1>
                {urgencyBadge(data.urgency_flag)}
                {!data.has_supplier_config && (
                  <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 text-xs">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    No supplier — 14d default
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{data.component_sku_id}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" />
                Current Stock
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round(data.current_stock)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Supplier</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-medium truncate">
                {data.supplier?.name || "Not configured"}
              </div>
              {data.supplier?.contact_name && (
                <p className="text-xs text-muted-foreground truncate">{data.supplier.contact_name}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Lead Time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.lead_time_days}d</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>MOQ</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data.moq ? Math.round(data.moq) : "—"}
              </div>
              {data.order_multiple && (
                <p className="text-xs text-muted-foreground">
                  Multiple: {Math.round(data.order_multiple)}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Unit Cost</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data.unit_cost ? `$${data.unit_cost.toFixed(2)}` : "—"}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Supply vs Demand Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Supply vs Demand — 12 Weeks</CardTitle>
            <CardDescription>
              Required quantity vs available stock + inbound POs. Red bars indicate shortfall.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="available" name="Available" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                <Bar dataKey="required" name="Required" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
                <Bar dataKey="shortfall" name="Shortfall" fill="#ef4444" radius={[2, 2, 0, 0]} />
                {orderByWeek && (
                  <ReferenceLine
                    x={formatWeek(orderByWeek.week_start)}
                    stroke="#f59e0b"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    label={{ value: "Order by", position: "top", fontSize: 10, fill: "#f59e0b" }}
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Week-by-Week Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Week-by-Week Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Week</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Required</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Available</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Shortfall</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Order Qty</th>
                  <th className="text-center py-2 px-3 font-medium text-muted-foreground">Order By</th>
                  <th className="text-center py-2 px-3 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.weeks.map((w) => (
                  <tr
                    key={w.week_start}
                    className={`border-b ${
                      w.urgency_flag === "OVERDUE"
                        ? "bg-red-50"
                        : w.urgency_flag === "URGENT"
                          ? "bg-amber-50"
                          : ""
                    }`}
                  >
                    <td className="py-2 px-3 font-medium">{formatDate(w.week_start)}</td>
                    <td className="py-2 px-3 text-right font-mono">{Math.round(w.required_qty)}</td>
                    <td className="py-2 px-3 text-right font-mono text-blue-600">{Math.round(w.available_qty)}</td>
                    <td className={`py-2 px-3 text-right font-mono font-bold ${w.shortfall_qty > 0 ? "text-red-600" : ""}`}>
                      {w.shortfall_qty > 0 ? Math.round(w.shortfall_qty) : "—"}
                    </td>
                    <td className="py-2 px-3 text-right font-mono">
                      {w.order_qty > 0 ? Math.round(w.order_qty) : "—"}
                    </td>
                    <td className={`py-2 px-3 text-center text-xs ${
                      w.urgency_flag === "OVERDUE" ? "text-red-600 font-bold" :
                      w.urgency_flag === "URGENT" ? "text-amber-600 font-medium" : ""
                    }`}>
                      {formatDate(w.order_by_date)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {urgencyBadge(w.urgency_flag)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Finished Goods Using This Material */}
        {data.finished_goods.length > 0 && (
          <Card>
            <CardHeader
              className="cursor-pointer"
              onClick={() => setShowFinishedGoods(!showFinishedGoods)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">
                    Finished Goods Using This Material
                  </CardTitle>
                  <CardDescription>
                    {data.finished_goods.length} product{data.finished_goods.length !== 1 ? "s" : ""} require this component
                  </CardDescription>
                </div>
                {showFinishedGoods ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </CardHeader>
            {showFinishedGoods && (
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Product</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">SKU</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Qty per Batch</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Batch Size</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Per Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.finished_goods.map((fg) => (
                      <tr key={fg.sku_id} className="border-b">
                        <td className="py-2 px-3 font-medium">
                          <Link
                            href={`/production-intelligence/sku/${fg.sku_id}`}
                            className="text-blue-600 hover:underline"
                          >
                            {fg.name}
                          </Link>
                        </td>
                        <td className="py-2 px-3 text-muted-foreground">{fg.sku_code}</td>
                        <td className="py-2 px-3 text-right font-mono">{fg.qty_per_batch}</td>
                        <td className="py-2 px-3 text-right font-mono">{fg.std_batch_size}</td>
                        <td className="py-2 px-3 text-right font-mono">
                          {(fg.qty_per_batch / (fg.std_batch_size || 1)).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
