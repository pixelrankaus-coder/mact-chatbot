"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  RefreshCw,
  Loader2,
  Save,
  ArrowUpIcon,
  ArrowDownIcon,
  AlertTriangle,
  ShieldAlert,
  ChevronDown,
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UnifiedForecastChart } from "./unified-forecast-chart";
import { StockProjectionChart } from "./stock-projection-chart";

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

interface ForecastData {
  sku: { cin7_product_id: string; sku_code: string; name: string };
  weeklyAvg: number;
  weeklySales: Array<{ week_start: string; qty: number }>;
  forecasts: Array<{ week_start: string; forecast_qty: number }>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatWeekFull(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function formatWeekShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Page Component ─────────────────────────────────────────────────────────

export default function SkuDetailPage() {
  const params = useParams();
  const skuId = params.skuId as string;

  const [projection, setProjection] = useState<SkuProjection | null>(null);
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [projRes, fcRes] = await Promise.all([
        fetch(`/api/production-intelligence/projection?sku_id=${skuId}`),
        fetch(`/api/production-intelligence/forecast?sku_id=${skuId}`),
      ]);
      if (projRes.ok) {
        const d = await projRes.json();
        setProjection(d.projection);
      }
      if (fcRes.ok) {
        const d = await fcRes.json();
        setForecast(d);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [skuId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const saveOverride = async (weekStart: string) => {
    const val = overrides[weekStart];
    if (val === undefined) return;
    setSaving(weekStart);
    try {
      await fetch("/api/production-intelligence/forecast", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku_id: skuId,
          week_start: weekStart,
          override_qty: val === "" ? null : Number(val),
        }),
      });
      await fetchData();
      setOverrides((prev) => {
        const next = { ...prev };
        delete next[weekStart];
        return next;
      });
    } catch {
      // ignore
    } finally {
      setSaving(null);
    }
  };

  const p = projection;

  // Chart data for unified chart
  const historicalSales = forecast?.weeklySales || [];
  const projectionWeeks = p?.weeks.map((w) => ({
    week_start: w.week_start,
    forecast_demand: w.forecast_demand,
    closing_stock: w.closing_stock,
  })) || [];

  // Collapsible table: show 3 rows by default
  const COLLAPSED_ROWS = 3;
  const visibleWeeks = expanded ? p?.weeks : p?.weeks.slice(0, COLLAPSED_ROWS);
  const hiddenCount = (p?.weeks.length || 0) - COLLAPSED_ROWS;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/production-intelligence"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
              {p?.name || "Loading..."}
            </h1>
            <p className="text-sm text-muted-foreground">{p?.sku_code}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden lg:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {loading && !p ? (
        <div className="space-y-4">
          <Skeleton className="h-[340px] w-full" />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[100px]" />)}
          </div>
          <Skeleton className="h-[200px] w-full" />
        </div>
      ) : !p ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          SKU not found or no projection data available.
        </div>
      ) : (
        <>
          {/* Unified Forecast Chart — full width */}
          <UnifiedForecastChart
            historicalSales={historicalSales}
            projectionWeeks={projectionWeeks}
            currentStock={p.current_stock}
            safetyStock={p.safety_stock}
          />

          {/* Stock Projection Chart */}
          <StockProjectionChart
            weeks={p.weeks.map((w) => ({
              week_start: w.week_start,
              closing_stock: w.closing_stock,
              risk_flag: w.risk_flag,
            }))}
            safetyStock={p.safety_stock}
          />

          {/* Metric Cards — 4 across */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="space-y-1">
                <CardDescription>Weeks of Cover</CardDescription>
                <div className={`font-display text-2xl lg:text-3xl ${
                  p.weeks_of_cover <= 2 ? "text-red-600" : p.weeks_of_cover <= 4 ? "text-amber-600" : "text-green-600"
                }`}>
                  {p.weeks_of_cover >= 12 ? "12+" : p.weeks_of_cover}w
                </div>
                <div className="flex items-center text-xs">
                  {p.weeks_of_cover <= 2 ? (
                    <AlertTriangle className="mr-1 size-3 text-red-500" />
                  ) : p.weeks_of_cover <= 4 ? (
                    <AlertTriangle className="mr-1 size-3 text-amber-500" />
                  ) : (
                    <ArrowUpIcon className="mr-1 size-3 text-green-500" />
                  )}
                  <span className="text-muted-foreground">
                    {p.stockout_week
                      ? `Stockout: ${formatWeekFull(p.stockout_week)}`
                      : "No stockout in 12 weeks"}
                  </span>
                </div>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="space-y-1">
                <CardDescription>Weekly Demand</CardDescription>
                <div className="font-display text-2xl lg:text-3xl">
                  {forecast?.weeklyAvg?.toFixed(1) || "—"}
                </div>
                <div className="flex items-center text-xs">
                  <ArrowDownIcon className="mr-1 size-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Weighted moving average</span>
                </div>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="space-y-1">
                <CardDescription>Safety Stock</CardDescription>
                <div className="font-display text-2xl lg:text-3xl">
                  {p.safety_stock}
                </div>
                <div className="flex items-center text-xs">
                  <ShieldAlert className="mr-1 size-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Minimum threshold</span>
                </div>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="space-y-1">
                <CardDescription>12-Week Demand</CardDescription>
                <div className="font-display text-2xl lg:text-3xl">
                  {Math.round(p.weeks.reduce((s, w) => s + w.forecast_demand, 0)).toLocaleString()}
                </div>
                <div className="flex items-center text-xs">
                  <span className="text-muted-foreground">Total forecast units</span>
                </div>
              </CardHeader>
            </Card>
          </div>

          {/* Week-by-Week Breakdown — collapsible */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Week-by-week breakdown</CardTitle>
                <CardDescription>
                  Override forecast by entering a value in the Override column
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Week</TableHead>
                      <TableHead className="text-right">Opening</TableHead>
                      <TableHead className="text-right">Inbound PO</TableHead>
                      <TableHead className="text-right">Forecast</TableHead>
                      <TableHead className="text-center">Override</TableHead>
                      <TableHead className="text-right">Orders</TableHead>
                      <TableHead className="text-right">Closing</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleWeeks?.map((w) => (
                      <TableRow key={w.week_start}>
                        <TableCell className="font-medium">{formatWeekShort(w.week_start)}</TableCell>
                        <TableCell className={`text-right font-mono ${w.opening_stock < 0 ? "text-red-600" : ""}`}>
                          {Math.round(w.opening_stock)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {w.inbound_po > 0 ? `+${w.inbound_po}` : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {w.forecast_demand.toFixed(1)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 justify-center">
                            <Input
                              type="number"
                              className="h-7 w-20 text-right text-xs"
                              placeholder="—"
                              value={overrides[w.week_start] ?? ""}
                              onChange={(e) =>
                                setOverrides((prev) => ({
                                  ...prev,
                                  [w.week_start]: e.target.value,
                                }))
                              }
                            />
                            {overrides[w.week_start] !== undefined && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => saveOverride(w.week_start)}
                                disabled={saving === w.week_start}
                              >
                                {saving === w.week_start ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Save className="h-3 w-3" />
                                )}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {w.existing_orders > 0 ? w.existing_orders : "—"}
                        </TableCell>
                        <TableCell className={`text-right font-mono font-bold ${w.closing_stock < 0 ? "text-red-600" : ""}`}>
                          {Math.round(w.closing_stock)}
                        </TableCell>
                        <TableCell className="text-center">
                          {w.closing_stock <= 0 ? (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
                              Stockout
                            </Badge>
                          ) : w.risk_flag === "STOCKOUT_RISK" ? (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                              Low
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                              OK
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Expand/collapse toggle */}
              {hiddenCount > 0 && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="mt-2 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
                  {expanded ? "Show less" : `+ ${hiddenCount} more weeks...`}
                </button>
              )}

              {/* Footer — last updated + method */}
              <div className="mt-4 border-t pt-3 text-xs text-muted-foreground text-center">
                Last updated: {new Date().toLocaleString("en-AU", {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                  timeZoneName: "short",
                })}{" "}
                · Forecast method: weighted moving average (24-week lookback)
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
