"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  RefreshCw,
  AlertTriangle,
  TrendingDown,
  ShieldAlert,
  ArrowRight,
  Loader2,
  Play,
  Settings,
  ShoppingCart,
  ArrowUpIcon,
  ArrowDownIcon,
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DemandChart } from "./components/demand-chart";

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

function formatWeek(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

function riskColor(weeksOfCover: number): string {
  if (weeksOfCover <= 2) return "text-red-600";
  if (weeksOfCover <= 4) return "text-amber-600";
  return "text-green-600";
}

function riskBg(weeksOfCover: number): string {
  if (weeksOfCover <= 2) return "bg-red-50 border-red-200";
  if (weeksOfCover <= 4) return "bg-amber-50 border-amber-200";
  return "bg-green-50 border-green-200";
}

function riskLabel(weeksOfCover: number): string {
  if (weeksOfCover <= 2) return "Critical";
  if (weeksOfCover <= 4) return "Warning";
  return "OK";
}

// ─── Mini Stock Chart ───────────────────────────────────────────────────────

function MiniStockChart({ weeks }: { weeks: WeekProjection[] }) {
  const values = weeks.map((w) => w.closing_stock);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const h = 40;
  const w = 120;

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
        <line x1="0" y1={zeroY} x2={w} y2={zeroY} stroke="#ef4444" strokeWidth="1" strokeDasharray="3,3" opacity="0.5" />
      )}
      <polyline fill="none" stroke={values.some((v) => v <= 0) ? "#ef4444" : "#3b82f6"} strokeWidth="1.5" points={points} />
    </svg>
  );
}

// ─── Cache ──────────────────────────────────────────────────────────────────

const CACHE_KEY_V1 = "pi-dashboard-v1";
const CACHE_TTL_V1 = 4 * 60 * 60 * 1000; // 4 hours

function readCacheV1(): { data: DashboardData; mrpData: MRPOverdueData; ts: number } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY_V1);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (Date.now() - cached.ts > CACHE_TTL_V1) {
      localStorage.removeItem(CACHE_KEY_V1);
      return null;
    }
    return cached;
  } catch {
    return null;
  }
}

function writeCacheV1(data: DashboardData, mrpData: MRPOverdueData) {
  try {
    localStorage.setItem(CACHE_KEY_V1, JSON.stringify({ data, mrpData, ts: Date.now() }));
  } catch {
    // storage full — ignore
  }
}

// ─── Page Component ─────────────────────────────────────────────────────────

export default function ProductionIntelligenceDashboard() {
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
        writeCacheV1(newData, newMrp);
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
    const cached = readCacheV1();
    if (cached) {
      setData(cached.data);
      setMrpData(cached.mrpData);
      const mins = Math.round((Date.now() - cached.ts) / 60000);
      setCacheAge(mins < 1 ? "just now" : mins < 60 ? `${mins}m ago` : `${Math.round(mins / 60)}h ago`);
    }
  }, []);

  const summary = data?.summary;
  const projections = data?.projections || [];

  return (
    <div className="space-y-4">
      {/* Header — matches Sales Dashboard */}
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

      {/* Top Row — Chart + Metric Cards (same grid as Sales Dashboard) */}
      <div className="gap-4 space-y-4 md:grid md:grid-cols-2 lg:space-y-0 xl:grid-cols-8">
        {/* Chart — col-span-4 */}
        <div className="md:col-span-4">
          <DemandChart projections={projections} loading={loading && !data} />
        </div>

        {/* Metric Cards — col-span-4, 2x2 grid */}
        <div className="md:col-span-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Stockout Risk */}
            <Card>
              <CardHeader className="space-y-1">
                <CardDescription>Stockout Risk</CardDescription>
                {loading && !data ? (
                  <>
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-4 w-40" />
                  </>
                ) : (
                  <>
                    <div className="font-display text-2xl lg:text-3xl">
                      {summary?.at_risk_skus || 0}
                    </div>
                    <div className="flex items-center text-xs">
                      {(summary?.at_risk_skus || 0) > 0 ? (
                        <ArrowUpIcon className="mr-1 size-3 text-red-500" />
                      ) : (
                        <ArrowDownIcon className="mr-1 size-3 text-green-500" />
                      )}
                      <span className={`font-medium ${(summary?.at_risk_skus || 0) > 0 ? "text-red-500" : "text-green-500"}`}>
                        {summary?.at_risk_skus || 0} SKUs
                      </span>
                      <span className="text-muted-foreground ml-1">projected to hit zero</span>
                    </div>
                  </>
                )}
              </CardHeader>
            </Card>

            {/* Below Safety Stock */}
            <Card>
              <CardHeader className="space-y-1">
                <CardDescription>Below Safety Stock</CardDescription>
                {loading && !data ? (
                  <>
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-4 w-40" />
                  </>
                ) : (
                  <>
                    <div className="font-display text-2xl lg:text-3xl">
                      {summary?.below_safety_skus || 0}
                    </div>
                    <div className="flex items-center text-xs">
                      {(summary?.below_safety_skus || 0) > 0 ? (
                        <AlertTriangle className="mr-1 size-3 text-amber-500" />
                      ) : (
                        <ArrowDownIcon className="mr-1 size-3 text-green-500" />
                      )}
                      <span className={`font-medium ${(summary?.below_safety_skus || 0) > 0 ? "text-amber-500" : "text-green-500"}`}>
                        {summary?.below_safety_skus || 0} SKUs
                      </span>
                      <span className="text-muted-foreground ml-1">within 12-week window</span>
                    </div>
                  </>
                )}
              </CardHeader>
            </Card>

            {/* Overdue POs */}
            <Card>
              <CardHeader className="space-y-1">
                <CardDescription>Overdue POs</CardDescription>
                {loading && !data ? (
                  <>
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-4 w-40" />
                  </>
                ) : (
                  <>
                    <div className="font-display text-2xl lg:text-3xl">
                      {mrpData?.overdue_count || 0}
                    </div>
                    <div className="flex items-center text-xs">
                      {(mrpData?.overdue_count || 0) > 0 ? (
                        <ShoppingCart className="mr-1 size-3 text-red-500" />
                      ) : (
                        <ArrowDownIcon className="mr-1 size-3 text-green-500" />
                      )}
                      <span className={`font-medium ${(mrpData?.overdue_count || 0) > 0 ? "text-red-500" : "text-green-500"}`}>
                        {mrpData?.overdue_count || 0} materials
                      </span>
                      <span className="text-muted-foreground ml-1">past order date</span>
                    </div>
                  </>
                )}
              </CardHeader>
            </Card>

            {/* Urgent Orders */}
            <Card>
              <CardHeader className="space-y-1">
                <CardDescription>Order This Week</CardDescription>
                {loading && !data ? (
                  <>
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-4 w-40" />
                  </>
                ) : (
                  <>
                    <div className="font-display text-2xl lg:text-3xl">
                      {mrpData?.urgent_count || 0}
                    </div>
                    <div className="flex items-center text-xs">
                      {(mrpData?.urgent_count || 0) > 0 ? (
                        <ShieldAlert className="mr-1 size-3 text-amber-500" />
                      ) : (
                        <ArrowDownIcon className="mr-1 size-3 text-green-500" />
                      )}
                      <span className={`font-medium ${(mrpData?.urgent_count || 0) > 0 ? "text-amber-500" : "text-green-500"}`}>
                        {mrpData?.urgent_count || 0} urgent
                      </span>
                      <span className="text-muted-foreground ml-1">material orders</span>
                    </div>
                  </>
                )}
              </CardHeader>
            </Card>
          </div>
        </div>
      </div>

      {/* Middle Row — Urgent Purchases + Projection Table (same as BestSelling + OrderStatus) */}
      <div className="gap-4 space-y-4 lg:space-y-0 xl:grid xl:grid-cols-3">
        {/* Urgent Purchases — col-span-1 */}
        <div className="xl:col-span-1">
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Urgent Purchases</CardTitle>
                <Link href="/production-intelligence/purchasing">
                  <Button variant="ghost" size="sm" className="h-7 text-xs">
                    View All
                  </Button>
                </Link>
              </div>
              <CardDescription>Materials needing immediate order</CardDescription>
            </CardHeader>
            <CardContent>
              {loading && !data ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : mrpData && mrpData.items.length > 0 ? (
                <div className="space-y-2">
                  {mrpData.items.slice(0, 5).map((item, idx) => (
                    <Link
                      key={`${item.component_sku_id}-${idx}`}
                      href={`/production-intelligence/purchasing/${item.component_sku_id}`}
                      className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                    >
                      <Badge
                        variant={item.urgency_flag === "OVERDUE" ? "destructive" : "default"}
                        className={`shrink-0 ${item.urgency_flag === "URGENT" ? "bg-amber-500 text-white" : ""}`}
                      >
                        {item.urgency_flag}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm truncate">{item.component_name}</div>
                        <div className="text-xs text-muted-foreground">
                          Shortfall: {Math.round(item.shortfall_qty)} units
                        </div>
                        {item.order_by_date && (
                          <div className={`text-xs mt-0.5 ${item.urgency_flag === "OVERDUE" ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                            Order by {new Date(item.order_by_date + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No urgent purchases
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Projection Table — col-span-2 */}
        <div className="xl:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-base">Stock Projection</CardTitle>
              <CardDescription>
                12-week stock trajectory. Click a SKU for details.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading && !data ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : projections.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <TrendingDown className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No projections available.</p>
                  <p className="text-xs mt-1">Run forecasts first, then refresh.</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {/* Header */}
                  <div className="grid grid-cols-[1fr_80px_80px_60px_120px_70px_24px] gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground border-b">
                    <div>SKU</div>
                    <div className="text-right">Stock</div>
                    <div className="text-right">Wk Demand</div>
                    <div className="text-center">Cover</div>
                    <div className="text-center">Trend</div>
                    <div className="text-center">Risk</div>
                    <div />
                  </div>
                  {projections.map((p) => {
                    const avgDemand =
                      p.weeks.length > 0
                        ? p.weeks.reduce((s, w) => s + w.forecast_demand, 0) / p.weeks.length
                        : 0;

                    return (
                      <Link
                        key={p.sku_id}
                        href={`/production-intelligence/sku/${p.sku_id}`}
                        className="grid grid-cols-[1fr_80px_80px_60px_120px_70px_24px] gap-2 px-3 py-2.5 rounded-lg border hover:bg-accent/50 transition-colors items-center"
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{p.name}</div>
                          <div className="text-xs text-muted-foreground">{p.sku_code}</div>
                        </div>
                        <div className="text-right font-mono text-sm">
                          {p.current_stock.toLocaleString()}
                        </div>
                        <div className="text-right font-mono text-sm">
                          {avgDemand.toFixed(1)}
                        </div>
                        <div className={`text-center font-bold text-sm ${riskColor(p.weeks_of_cover)}`}>
                          {p.weeks_of_cover >= 12 ? "12+" : p.weeks_of_cover}w
                        </div>
                        <div className="flex justify-center">
                          <MiniStockChart weeks={p.weeks} />
                        </div>
                        <div className="flex justify-center">
                          <Badge variant="outline" className={`text-[10px] ${riskBg(p.weeks_of_cover)}`}>
                            {riskLabel(p.weeks_of_cover)}
                          </Badge>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom — Heatmap */}
      {projections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Week-by-Week Closing Stock</CardTitle>
            <CardDescription>
              Green = healthy, amber = below safety, red = stockout
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-card z-10">SKU</TableHead>
                  {projections[0]?.weeks.map((w) => (
                    <TableHead key={w.week_start} className="text-center min-w-[52px]">
                      {formatWeek(w.week_start)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {projections.map((p) => (
                  <TableRow key={p.sku_id}>
                    <TableCell className="font-medium truncate max-w-[150px] sticky left-0 bg-card z-10">
                      {p.sku_code}
                    </TableCell>
                    {p.weeks.map((w) => {
                      let bg = "bg-green-100 text-green-800";
                      if (w.closing_stock <= 0) bg = "bg-red-200 text-red-900 font-bold";
                      else if (w.risk_flag === "STOCKOUT_RISK") bg = "bg-amber-100 text-amber-800";

                      return (
                        <TableCell key={w.week_start} className={`text-center ${bg}`}>
                          {Math.round(w.closing_stock)}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
