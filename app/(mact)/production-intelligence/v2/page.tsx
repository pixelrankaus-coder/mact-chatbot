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
  Search,
  CalendarClock,
  Factory,
  AlertTriangle,
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

// ─── Cache ──────────────────────────────────────────────────────────────────

const CACHE_KEY = "pi-dashboard-v2";
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

function readCache(): { data: DashboardData; mrpData: MRPOverdueData; ts: number } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (Date.now() - cached.ts > CACHE_TTL) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return cached;
  } catch {
    return null;
  }
}

function writeCache(data: DashboardData, mrpData: MRPOverdueData) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, mrpData, ts: Date.now() }));
  } catch {
    // storage full — ignore
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function coverColor(weeksOfCover: number): string {
  if (weeksOfCover <= 2) return "text-red-600";
  if (weeksOfCover <= 4) return "text-amber-600";
  return "text-green-600";
}

function riskLevel(weeksOfCover: number, currentStock: number): "critical" | "warning" | "ok" {
  if (weeksOfCover === 0 && currentStock < 0) return "critical";
  if (weeksOfCover <= 2) return "critical";
  if (weeksOfCover <= 4) return "warning";
  return "ok";
}

function barColor(risk: "critical" | "warning" | "ok"): string {
  if (risk === "critical") return "#ef4444";
  if (risk === "warning") return "#f59e0b";
  return "#22c55e";
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
  const firstHalf = values.slice(0, mid).reduce((s, v) => s + v, 0) / (mid || 1);
  const secondHalf = values.slice(mid).reduce((s, v) => s + v, 0) / ((values.length - mid) || 1);
  const declining = secondHalf < firstHalf * 0.9;
  const strokeColor = declining ? "#ef4444" : "#00BCD4";

  const points = values
    .map((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * w;
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

// ─── Stock Bar ──────────────────────────────────────────────────────────────

function StockBar({ stock, maxStock, risk }: { stock: number; maxStock: number; risk: "critical" | "warning" | "ok" }) {
  const pct = maxStock > 0 ? Math.max(0, Math.min(100, (stock / maxStock) * 100)) : 0;
  const color = barColor(risk);

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-sm font-mono text-gray-900 w-12 text-right shrink-0">
        {stock.toLocaleString()}
      </span>
    </div>
  );
}

// ─── Action Button ──────────────────────────────────────────────────────────

function ActionCell({ weeksOfCover, currentStock, skuId }: { weeksOfCover: number; currentStock: number; skuId: string }) {
  if (weeksOfCover >= 5) {
    return (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px]">
        OK
      </Badge>
    );
  }

  let label: string;
  let variant: "destructive" | "outline" = "outline";
  let className = "";

  if (weeksOfCover === 0 && currentStock < 0) {
    label = "Investigate";
    variant = "outline";
    className = "border-red-300 text-red-700 hover:bg-red-50";
  } else if (weeksOfCover === 0) {
    label = "Schedule now";
    variant = "destructive";
    className = "";
  } else if (weeksOfCover <= 2) {
    label = "Schedule this week";
    variant = "outline";
    className = "border-amber-300 text-amber-700 hover:bg-amber-50";
  } else {
    label = "Plan ahead";
    variant = "outline";
    className = "border-slate-300 text-slate-600 hover:bg-slate-50";
  }

  return (
    <Button
      size="sm"
      variant={variant}
      className={`h-7 text-[11px] px-2.5 ${className}`}
      asChild
    >
      <Link href={`/production-intelligence/sku/${skuId}`}>
        {label}
      </Link>
    </Button>
  );
}

// ─── Action Queue Item ──────────────────────────────────────────────────────

function ActionQueueItem({ projection }: { projection: SkuProjection }) {
  const risk = riskLevel(projection.weeks_of_cover, projection.current_stock);
  const isNegative = projection.current_stock < 0;

  let actionText: string;
  let buttonLabel: string;
  let buttonIcon: React.ReactNode;

  if (isNegative) {
    actionText = `Stock negative (${projection.current_stock}) \u00b7 ${projection.weeks_of_cover}w cover`;
    buttonLabel = "Investigate";
    buttonIcon = <Search className="h-3.5 w-3.5" />;
  } else if (projection.weeks_of_cover === 0) {
    actionText = `Schedule production run \u00b7 0w cover`;
    buttonLabel = "Schedule run";
    buttonIcon = <Factory className="h-3.5 w-3.5" />;
  } else {
    const avgDemand = projection.weeks.length > 0
      ? projection.weeks.reduce((s, w) => s + w.forecast_demand, 0) / projection.weeks.length
      : 0;
    const orderQty = Math.ceil(avgDemand * 4);
    actionText = `Order ~${orderQty} units \u00b7 ${projection.weeks_of_cover}w cover`;
    buttonLabel = "Create PO";
    buttonIcon = <CalendarClock className="h-3.5 w-3.5" />;
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-gray-900 truncate">{projection.name}</div>
        <div className="text-xs text-gray-400">{projection.sku_code}</div>
        <div className={`text-xs mt-0.5 ${risk === "critical" ? "text-red-600 font-medium" : "text-gray-500"}`}>
          {actionText}
        </div>
      </div>
      <Button
        size="sm"
        variant={risk === "critical" ? "destructive" : "outline"}
        className="shrink-0 h-7 text-xs gap-1.5"
        asChild
      >
        <Link href={`/production-intelligence/sku/${projection.sku_id}`}>
          {buttonIcon}
          {buttonLabel}
        </Link>
      </Button>
    </div>
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
    const totalSafety = projections.reduce((s, p) => s + (p.safety_stock || 0), 0);

    return Array.from({ length: weekCount }, (_, i) => {
      const weekStart = projections[0].weeks[i].week_start;
      let stock = 0;
      for (const p of projections) {
        if (p.weeks[i]) stock += Math.max(0, p.weeks[i].closing_stock);
      }
      let fill = "#22c55e";
      if (stock <= 0) fill = "#ef4444";
      else if (totalSafety > 0 && stock < totalSafety) fill = "#f59e0b";
      else if (totalSafety === 0) fill = "#00BCD4";

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
                className="w-[200px]"
                nameKey="stock"
                labelFormatter={(value) => {
                  const start = new Date(value + "T00:00:00");
                  const end = new Date(start);
                  end.setDate(end.getDate() + 6);
                  const fmt = (d: Date) => d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
                  const startStr = fmt(start);
                  const endStr = start.getMonth() === end.getMonth()
                    ? end.getDate().toString()
                    : fmt(end);
                  return `Week ${startStr}\u2013${endStr} ${start.getFullYear()}`;
                }}
                formatter={(value) => [`${Number(value).toLocaleString()} units \u00b7 Closing Stock`]}
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
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [cacheAge, setCacheAge] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const [dashRes, mrpRes] = await Promise.all([
        fetch("/api/production-intelligence/dashboard"),
        fetch("/api/production-intelligence/mrp/overdue"),
      ]);
      let newData: DashboardData | null = null;
      let newMrp: MRPOverdueData | null = null;
      if (dashRes.ok) newData = await dashRes.json();
      if (mrpRes.ok) newMrp = await mrpRes.json();
      if (newData) setData(newData);
      if (newMrp) setMrpData(newMrp);
      if (newData && newMrp) {
        writeCache(newData, newMrp);
        setCacheAge(null);
      }
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

  // Load from cache on mount — no API call unless cache is stale/missing
  useEffect(() => {
    const cached = readCache();
    if (cached) {
      setData(cached.data);
      setMrpData(cached.mrpData);
      const mins = Math.round((Date.now() - cached.ts) / 60000);
      setCacheAge(mins < 1 ? "just now" : mins < 60 ? `${mins}m ago` : `${Math.round(mins / 60)}h ago`);
    }
  }, []);

  const summary = data?.summary;
  const projections = data?.projections || [];
  const isInitialLoad = loading && !data;

  // Max stock across all SKUs for bar width normalization
  const maxStock = projections.reduce((m, p) => Math.max(m, p.current_stock), 1);

  // Top 3 most urgent SKUs for Action Queue (sorted by weeks_of_cover ascending, then stock ascending)
  const urgentSkus = [...projections]
    .filter((p) => p.weeks_of_cover < 5)
    .sort((a, b) => a.weeks_of_cover - b.weeks_of_cover || a.current_stock - b.current_stock)
    .slice(0, 3);

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
          {cacheAge && (
            <span className="text-xs text-gray-400 hidden lg:inline">Cached {cacheAge}</span>
          )}
        </div>
      </div>

      {/* KPI Row — 4 tiles */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiTile
          label="Stockout Risk"
          value={summary?.at_risk_skus || 0}
          subtext="SKUs projected to hit zero"
          loading={isInitialLoad}
          valueColor={(summary?.at_risk_skus || 0) > 0 ? "text-[#ef4444]" : "text-gray-900"}
        />
        <KpiTile
          label="Below Safety Stock"
          value={summary?.below_safety_skus || 0}
          subtext="Within 12-week window"
          loading={isInitialLoad}
          valueColor={(summary?.below_safety_skus || 0) > 0 ? "text-[#f59e0b]" : "text-gray-900"}
        />
        <KpiTile
          label="Overdue POs"
          value={mrpData?.overdue_count || 0}
          subtext="Materials past order date"
          loading={isInitialLoad}
          valueColor={(mrpData?.overdue_count || 0) > 0 ? "text-[#ef4444]" : "text-gray-900"}
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
        {/* Left Column — Outlook + Action Queue stacked */}
        <div className="flex flex-col gap-6">
          {/* 12-Week Outlook Chart */}
          <OutlookChart projections={projections} loading={isInitialLoad} />

          {/* Action Queue */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-1 flex items-center justify-between">
              <div className="text-sm font-bold text-gray-900">Action Queue</div>
              <Link href="#">
                <Button variant="ghost" size="sm" className="h-7 text-xs text-gray-500 hover:text-gray-900">
                  View all <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            </div>
            <div className="mb-3 text-xs text-gray-500">Top actions to take today</div>

            {isInitialLoad ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : urgentSkus.length > 0 ? (
              <div className="space-y-2">
                {urgentSkus.map((p) => (
                  <ActionQueueItem key={p.sku_id} projection={p} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center py-10 text-gray-400">
                <PackageX className="h-8 w-8 mb-2 opacity-50" />
                <div className="text-sm">No urgent actions today</div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column — Stock Projection Table */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-1 text-sm font-bold text-gray-900">Stock Projection</div>
          <div className="mb-4 text-xs text-gray-500">
            12-week stock trajectory. Click a row for details.
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
              <div className="sticky top-0 z-10 grid grid-cols-[28%_20%_10%_8%_16%_18%] gap-2 border-b border-slate-200 bg-white px-3 py-2 text-xs font-medium text-gray-500">
                <div>SKU</div>
                <div>Stock on hand</div>
                <div className="text-right">Wk demand</div>
                <div className="text-center">Cover</div>
                <div className="text-center">12-wk trend</div>
                <div className="text-center">Action</div>
              </div>
              {/* Table Rows */}
              {projections.map((p) => {
                const avgDemand =
                  p.weeks.length > 0
                    ? p.weeks.reduce((s, w) => s + w.forecast_demand, 0) / p.weeks.length
                    : 0;
                const risk = riskLevel(p.weeks_of_cover, p.current_stock);

                return (
                  <Link
                    key={p.sku_id}
                    href={`/production-intelligence/sku/${p.sku_id}`}
                    className="group grid grid-cols-[28%_20%_10%_8%_16%_18%] gap-2 items-center px-3 py-3 border-b border-slate-100 hover:bg-[#f8fafc]"
                  >
                    {/* SKU */}
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">{p.name}</div>
                      <div className="text-xs text-gray-400">{p.sku_code}</div>
                    </div>
                    {/* Stock on hand — visual bar */}
                    <StockBar stock={p.current_stock} maxStock={maxStock} risk={risk} />
                    {/* Wk demand */}
                    <div className="text-right font-mono text-sm text-gray-900">
                      {avgDemand.toFixed(1)}
                    </div>
                    {/* Cover badge */}
                    <div className="flex justify-center">
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-bold ${
                          p.weeks_of_cover === 0
                            ? "bg-red-50 text-red-700 border-red-200"
                            : p.weeks_of_cover <= 2
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : p.weeks_of_cover <= 4
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-green-50 text-green-700 border-green-200"
                        }`}
                      >
                        {p.weeks_of_cover >= 12 ? "12+" : p.weeks_of_cover}w
                      </Badge>
                    </div>
                    {/* Sparkline */}
                    <div className="flex justify-center">
                      <Sparkline weeks={p.weeks} />
                    </div>
                    {/* Action */}
                    <div className="flex justify-center" onClick={(e) => e.preventDefault()}>
                      <ActionCell weeksOfCover={p.weeks_of_cover} currentStock={p.current_stock} skuId={p.sku_id} />
                    </div>
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
