"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  RefreshCw,
  TrendingDown,
  Loader2,
  Play,
  Settings,
  ArrowRight,
  PackageX,
  ShoppingCart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Cell } from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

// ─── Types ──────────────────────────────────────────────────────────────────

interface WeekProjection {
  week_start: string;
  opening_stock: number;
  inbound_po: number;
  forecast_demand: number;
  existing_orders: number;
  closing_stock: number;
  risk_flag: "STOCKOUT_RISK" | "PROJECTED_STOCKOUT" | null;
}

interface SkuProjection {
  sku_id: string;
  sku_code: string;
  name: string;
  current_stock: number;
  safety_stock: number;
  weeks: WeekProjection[];
  stockout_week: string | null;
  weeks_of_cover: number;
}

interface DashboardData {
  summary: {
    pilot_skus: number;
    at_risk_skus: number;
    below_safety_skus: number;
    total_12wk_forecast_demand: number;
  };
  projections: SkuProjection[];
  error?: string;
}

interface MRPOverdueData {
  count: number;
  overdue_count: number;
  urgent_count: number;
  items: Array<{
    component_sku_id: string;
    component_name: string;
    order_by_date: string | null;
    shortfall_qty: number;
    urgency_flag: string;
  }>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function riskColor(weeksOfCover: number): string {
  if (weeksOfCover <= 2) return "text-red-600";
  if (weeksOfCover <= 4) return "text-amber-600";
  return "text-green-600";
}

function riskBadge(weeksOfCover: number) {
  if (weeksOfCover <= 2)
    return { label: "Critical", className: "bg-red-50 text-red-700 border-red-200" };
  if (weeksOfCover <= 4)
    return { label: "Warning", className: "bg-amber-50 text-amber-700 border-amber-200" };
  return { label: "OK", className: "bg-green-50 text-green-700 border-green-200" };
}

// ─── KPI Tile ───────────────────────────────────────────────────────────────

function KpiTile({
  label,
  value,
  subtext,
  loading,
  valueColor,
}: {
  label: string;
  value: number;
  subtext: string;
  loading: boolean;
  valueColor: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-28" />
        </div>
      ) : (
        <>
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
            {label}
          </div>
          <div className={`mt-1 text-[28px] font-extrabold leading-none ${valueColor}`}>
            {value}
          </div>
          <div className="mt-1 text-xs text-gray-500">{subtext}</div>
        </>
      )}
    </div>
  );
}

// ─── Mini Sparkline ─────────────────────────────────────────────────────────

function Sparkline({ weeks }: { weeks: WeekProjection[] }) {
  const values = weeks.map((w) => w.closing_stock);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const h = 32;
  const w = 140;

  // Determine trend: compare first half avg to second half avg
  const mid = Math.floor(values.length / 2);
  const firstHalf = values.slice(0, mid).reduce((s, v) => s + v, 0) / mid;
  const secondHalf = values.slice(mid).reduce((s, v) => s + v, 0) / (values.length - mid);
  const declining = secondHalf < firstHalf * 0.9;
  const strokeColor = declining ? "#ef4444" : "#00BCD4";

  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x},${y}`;
    })
    .join(" ");

  const zeroY = h - ((0 - min) / range) * h;

  return (
    <svg width={w} height={h + 4} className="shrink-0">
      {min < 0 && (
        <line x1="0" y1={zeroY} x2={w} y2={zeroY} stroke="#ef4444" strokeWidth="1" strokeDasharray="3,3" opacity="0.4" />
      )}
      <polyline fill="none" stroke={strokeColor} strokeWidth="2" points={points} />
    </svg>
  );
}

// ─── 12-Week Outlook Chart ──────────────────────────────────────────────────

const chartConfig = {
  stock: { label: "Closing Stock", color: "#00BCD4" },
} satisfies ChartConfig;

function OutlookChart({
  projections,
  loading,
}: {
  projections: SkuProjection[];
  loading: boolean;
}) {
  const chartData = React.useMemo(() => {
    if (!projections.length || !projections[0]?.weeks.length) return [];
    const weekCount = projections[0].weeks.length;
    // Aggregate safety stock across all SKUs
    const totalSafety = projections.reduce((s, p) => s + (p.safety_stock || 0), 0);

    return Array.from({ length: weekCount }, (_, i) => {
      const weekStart = projections[0].weeks[i].week_start;
      let stock = 0;
      for (const p of projections) {
        if (p.weeks[i]) stock += Math.max(0, p.weeks[i].closing_stock);
      }
      // Determine bar color based on risk
      let fill = "#22c55e"; // green — above safety
      if (stock <= 0) fill = "#ef4444"; // red — stockout
      else if (stock < totalSafety) fill = "#f59e0b"; // amber — below safety

      return { week: weekStart, stock: Math.round(stock), fill };
    });
  }, [projections]);

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <Skeleton className="mb-3 h-4 w-32" />
        <Skeleton className="h-[220px] w-full" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-1 text-sm font-bold text-gray-900">12-Week Outlook</div>
      <div className="mb-3 text-xs text-gray-500">
        Aggregate closing stock across all pilot SKUs
      </div>
      <ChartContainer config={chartConfig} className="h-[220px] w-full">
        <BarChart data={chartData} margin={{ left: 0, right: 0, bottom: 0, top: 4 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="week"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(value) => {
              const date = new Date(value + "T00:00:00");
              return date.toLocaleDateString("en-AU", { month: "short", day: "numeric" });
            }}
            className="text-xs"
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => v.toLocaleString()}
            width={50}
            className="text-xs"
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                className="w-[180px]"
                nameKey="stock"
                labelFormatter={(value) => {
                  const date = new Date(value + "T00:00:00");
                  return `Week of ${date.toLocaleDateString("en-AU", { month: "short", day: "numeric", year: "numeric" })}`;
                }}
                formatter={(value) => [`${Number(value).toLocaleString()} units`, "Closing Stock"]}
              />
            }
          />
          <Bar dataKey="stock" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={index} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  );
}

// ─── Page Component ─────────────────────────────────────────────────────────

export default function ProductionIntelligenceDashboardV2() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [mrpData, setMrpData] = useState<MRPOverdueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const [dashRes, mrpRes] = await Promise.all([
        fetch("/api/production-intelligence/dashboard"),
        fetch("/api/production-intelligence/mrp/overdue"),
      ]);
      if (dashRes.ok) setData(await dashRes.json());
      if (mrpRes.ok) setMrpData(await mrpRes.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const runForecasts = async () => {
    setGenerating(true);
    try {
      await fetch("/api/production-intelligence/forecast", { method: "POST" });
      await fetchDashboard();
    } catch {
      // ignore
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const summary = data?.summary;
  const projections = data?.projections || [];
  const isInitialLoad = loading && !data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
          Production Intelligence
        </h1>
        <div className="flex items-center space-x-2">
          <Link href="/production-intelligence/settings">
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4" />
              <span className="hidden lg:inline">Data Sync</span>
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={runForecasts} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            <span className="hidden lg:inline">{generating ? "Generating..." : "Run Forecasts"}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={fetchDashboard} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden lg:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* KPI Row — 4 tiles */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiTile
          label="Stockout Risk"
          value={summary?.at_risk_skus || 0}
          subtext="SKUs projected to hit zero"
          loading={isInitialLoad}
          valueColor={(summary?.at_risk_skus || 0) > 0 ? "text-red-600" : "text-gray-900"}
        />
        <KpiTile
          label="Below Safety Stock"
          value={summary?.below_safety_skus || 0}
          subtext="Within 12-week window"
          loading={isInitialLoad}
          valueColor={(summary?.below_safety_skus || 0) > 0 ? "text-amber-500" : "text-gray-900"}
        />
        <KpiTile
          label="Overdue POs"
          value={mrpData?.overdue_count || 0}
          subtext="Materials past order date"
          loading={isInitialLoad}
          valueColor={(mrpData?.overdue_count || 0) > 0 ? "text-red-600" : "text-gray-900"}
        />
        <KpiTile
          label="Order This Week"
          value={mrpData?.urgent_count || 0}
          subtext="Urgent material orders"
          loading={isInitialLoad}
          valueColor={(mrpData?.urgent_count || 0) > 0 ? "text-[#00BCD4]" : "text-gray-400"}
        />
      </div>

      {/* Main Content — Left/Right split */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[2fr_3fr]">
        {/* Left Column — Outlook + Urgent Purchases stacked */}
        <div className="flex flex-col gap-6">
          {/* 12-Week Outlook Chart */}
          <OutlookChart projections={projections} loading={isInitialLoad} />

          {/* Urgent Purchases */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-1 flex items-center justify-between">
              <div className="text-sm font-bold text-gray-900">Urgent Purchases</div>
              <Link href="/production-intelligence/purchasing">
                <Button variant="ghost" size="sm" className="h-7 text-xs text-gray-500 hover:text-gray-900">
                  View All
                </Button>
              </Link>
            </div>
            <div className="mb-3 text-xs text-gray-500">Materials needing immediate order</div>

            {isInitialLoad ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : mrpData && mrpData.items.length > 0 ? (
              <div className="space-y-2">
                {mrpData.items.slice(0, 5).map((item, idx) => (
                  <div
                    key={`${item.component_sku_id}-${idx}`}
                    className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
                  >
                    <Badge
                      variant={item.urgency_flag === "OVERDUE" ? "destructive" : "default"}
                      className={`shrink-0 text-[10px] ${item.urgency_flag === "URGENT" ? "bg-amber-500 text-white border-amber-500" : ""}`}
                    >
                      {item.urgency_flag}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-gray-900 truncate">
                        {item.component_name}
                      </div>
                      <div className="text-xs text-gray-500">
                        Shortfall: {Math.round(item.shortfall_qty)} units
                      </div>
                      {item.order_by_date && (
                        <div className={`text-xs mt-0.5 ${item.urgency_flag === "OVERDUE" ? "text-red-600 font-medium" : "text-gray-500"}`}>
                          Order by {new Date(item.order_by_date + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                        </div>
                      )}
                    </div>
                    {item.urgency_flag === "OVERDUE" && (
                      <Button size="sm" variant="destructive" className="shrink-0 h-7 text-xs">
                        Order now
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center py-10 text-gray-400">
                <PackageX className="h-8 w-8 mb-2 opacity-50" />
                <div className="text-sm">No urgent purchases</div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column — Stock Projection Table */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-1 text-sm font-bold text-gray-900">Stock Projection</div>
          <div className="mb-4 text-xs text-gray-500">
            12-week stock trajectory. Click a SKU for details.
          </div>

          {isInitialLoad ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : projections.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-gray-400">
              <TrendingDown className="h-8 w-8 mb-2 opacity-50" />
              <div className="text-sm">No projections available.</div>
              <div className="text-xs mt-1">Run forecasts first, then refresh.</div>
            </div>
          ) : (
            <div className="max-h-[600px] overflow-y-auto">
              {/* Table Header */}
              <div className="sticky top-0 z-10 grid grid-cols-[1fr_72px_72px_52px_140px_64px_20px] gap-2 border-b border-slate-200 bg-white px-3 py-2 text-xs font-medium text-gray-500">
                <div>SKU</div>
                <div className="text-right">Stock</div>
                <div className="text-right">Wk Demand</div>
                <div className="text-center">Cover</div>
                <div className="text-center">Trend</div>
                <div className="text-center">Risk</div>
                <div />
              </div>
              {/* Table Rows */}
              {projections.map((p) => {
                const avgDemand =
                  p.weeks.length > 0
                    ? p.weeks.reduce((s, w) => s + w.forecast_demand, 0) / p.weeks.length
                    : 0;
                const badge = riskBadge(p.weeks_of_cover);

                return (
                  <Link
                    key={p.sku_id}
                    href={`/production-intelligence/sku/${p.sku_id}`}
                    className="group grid grid-cols-[1fr_72px_72px_52px_140px_64px_20px] gap-2 items-center px-3 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">{p.name}</div>
                      <div className="text-xs text-gray-400">{p.sku_code}</div>
                    </div>
                    <div className="text-right font-mono text-sm text-gray-900">
                      {p.current_stock.toLocaleString()}
                    </div>
                    <div className="text-right font-mono text-sm text-gray-900">
                      {avgDemand.toFixed(1)}
                    </div>
                    <div className={`text-center text-sm font-bold ${riskColor(p.weeks_of_cover)}`}>
                      {p.weeks_of_cover >= 12 ? "12+" : p.weeks_of_cover}w
                    </div>
                    <div className="flex justify-center">
                      <Sparkline weeks={p.weeks} />
                    </div>
                    <div className="flex justify-center">
                      <Badge variant="outline" className={`text-[10px] ${badge.className}`}>
                        {badge.label}
                      </Badge>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-gray-400 group-hover:text-gray-900 transition-colors" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
