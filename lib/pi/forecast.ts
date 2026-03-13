/**
 * Production Intelligence — Demand Forecast Engine
 *
 * Weighted Moving Average forecast for pilot SKUs.
 * - Look-back: 24 weeks of sales history
 * - Recent 8 weeks weighted 2x vs prior 16 weeks
 * - Zero-sales weeks included in denominator
 * - Project orders excluded from baseline average
 * - Seasonality index applied per calendar month
 * - Output: weekly forecast for next 12 weeks per SKU
 */

import { createServiceClient } from "@/lib/supabase";

export interface WeeklySales {
  week_start: string; // YYYY-MM-DD (Monday)
  qty: number;
}

/**
 * Get the Monday of a given date's week
 */
function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

/**
 * Generate all Mondays in a date range (inclusive)
 */
function allMondaysInRange(from: Date, to: Date): string[] {
  const mondays: string[] = [];
  const current = getMonday(new Date(from));
  const end = getMonday(new Date(to));
  while (current <= end) {
    mondays.push(formatDate(current));
    current.setDate(current.getDate() + 7);
  }
  return mondays;
}

/**
 * Aggregate daily sales into weekly buckets, excluding project orders.
 * Fills zero-qty entries for every week in the lookback window.
 */
function aggregateWeekly(
  sales: Array<{ order_date: string; qty_sold: number; is_project_order?: boolean }>,
  windowStart: Date,
  windowEnd: Date
): WeeklySales[] {
  const buckets = new Map<string, number>();

  // Pre-fill every week in the window with 0
  for (const monday of allMondaysInRange(windowStart, windowEnd)) {
    buckets.set(monday, 0);
  }

  // Sum base sales (exclude project orders)
  for (const s of sales) {
    if (s.is_project_order) continue;
    const monday = getMonday(new Date(s.order_date));
    const key = formatDate(monday);
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) || 0) + s.qty_sold);
    }
  }

  return Array.from(buckets.entries())
    .map(([week_start, qty]) => ({ week_start, qty }))
    .sort((a, b) => a.week_start.localeCompare(b.week_start));
}

/**
 * Generate weighted moving average from weekly sales.
 * Uses full 24-week window including zero-sales weeks.
 */
function weightedMovingAverage(weeklySales: WeeklySales[]): number {
  if (weeklySales.length === 0) return 0;

  // Use up to 24 weeks
  const recent = weeklySales.slice(-24);

  let weightedSum = 0;
  let totalWeight = 0;

  for (let i = 0; i < recent.length; i++) {
    // Last 8 weeks get 2x weight, prior weeks get 1x
    const isRecent = i >= recent.length - 8;
    const weight = isRecent ? 2 : 1;
    weightedSum += recent[i].qty * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/**
 * Calculate seasonality index per calendar month.
 * Returns a map of month (0-11) → multiplier.
 */
function calculateSeasonalityIndex(
  allSales: Array<{ order_date: string; qty_sold: number; is_project_order?: boolean }>
): Map<number, number> {
  // Bucket base sales by calendar month
  const monthTotals = new Map<number, number>(); // month → total qty
  const monthWeeks = new Map<number, Set<string>>(); // month → set of week keys

  for (const s of allSales) {
    if (s.is_project_order) continue;
    const d = new Date(s.order_date);
    const month = d.getMonth();
    const monday = getMonday(d);
    const weekKey = formatDate(monday);

    monthTotals.set(month, (monthTotals.get(month) || 0) + s.qty_sold);
    if (!monthWeeks.has(month)) monthWeeks.set(month, new Set());
    monthWeeks.get(month)!.add(weekKey);
  }

  // Calculate per-month weekly average
  const monthlyAvg = new Map<number, number>();
  let overallTotal = 0;
  let overallWeekCount = 0;

  for (const [month, total] of monthTotals) {
    const weekCount = monthWeeks.get(month)?.size || 1;
    const avg = total / weekCount;
    monthlyAvg.set(month, avg);
    overallTotal += total;
    overallWeekCount += weekCount;
  }

  const overallAvg = overallWeekCount > 0 ? overallTotal / overallWeekCount : 0;

  // Build index: monthly_avg / overall_avg
  const index = new Map<number, number>();
  for (let m = 0; m < 12; m++) {
    const mAvg = monthlyAvg.get(m);
    const mWeeks = monthWeeks.get(m)?.size || 0;

    // Default to 1.0 if no data, fewer than 4 weeks, or overall is 0
    if (!mAvg || mWeeks < 4 || overallAvg === 0) {
      index.set(m, 1.0);
    } else {
      index.set(m, mAvg / overallAvg);
    }
  }

  return index;
}

/**
 * Run forecast for a single SKU
 */
export async function forecastSku(skuId: string, skuCode: string): Promise<{
  weeklyAvg: number;
  weeklySales: WeeklySales[];
  forecasts: Array<{ week_start: string; forecast_qty: number }>;
}> {
  const supabase = createServiceClient();

  // Fetch 6 months of sales history (includes is_project_order flag)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const { data: sales } = await supabase
    .from("pi_sales_history")
    .select("order_date, qty_sold, is_project_order")
    .eq("sku_code", skuCode)
    .gte("order_date", formatDate(sixMonthsAgo))
    .order("order_date", { ascending: true });

  const allSales = sales || [];

  // FIX 1 + FIX 2: Aggregate with zero-fill and project order exclusion
  const today = new Date();
  const weeklySales = aggregateWeekly(allSales, sixMonthsAgo, today);
  const weeklyAvg = weightedMovingAverage(weeklySales);

  // FIX 3: Seasonality index
  const seasonality = calculateSeasonalityIndex(allSales);

  // Generate 12 weeks of forecasts starting from next Monday
  const nextMonday = getMonday(new Date(today.getTime() + 7 * 86400000));
  const forecasts: Array<{ week_start: string; forecast_qty: number }> = [];

  for (let i = 0; i < 12; i++) {
    const weekStart = new Date(nextMonday.getTime() + i * 7 * 86400000);
    const month = weekStart.getMonth();
    const seasonalMultiplier = seasonality.get(month) ?? 1.0;
    const forecastQty = Math.round(weeklyAvg * seasonalMultiplier * 100) / 100;

    forecasts.push({
      week_start: formatDate(weekStart),
      forecast_qty: Math.max(0, forecastQty), // Never negative
    });
  }

  return { weeklyAvg, weeklySales: weeklySales.slice(-12), forecasts };
}

/**
 * Run forecast for all pilot SKUs and save to pi_forecasts
 */
export async function runAllForecasts(): Promise<{ skus: number; forecasts: number; error?: string }> {
  const supabase = createServiceClient();

  try {
    // Get pilot SKUs
    const { data: pilotSkus } = await supabase
      .from("pi_skus")
      .select("cin7_product_id, sku_code, name")
      .eq("is_pilot", true);

    if (!pilotSkus || pilotSkus.length === 0) {
      return { skus: 0, forecasts: 0, error: "No pilot SKUs configured" };
    }

    let totalForecasts = 0;

    for (const sku of pilotSkus) {
      const { forecasts } = await forecastSku(sku.cin7_product_id, sku.sku_code);

      const rows = forecasts.map((f) => ({
        sku_id: sku.cin7_product_id,
        week_start: f.week_start,
        forecast_qty: f.forecast_qty,
        method: "weighted_avg_seasonal",
        generated_at: new Date().toISOString(),
      }));

      if (rows.length > 0) {
        await supabase
          .from("pi_forecasts")
          .upsert(rows, { onConflict: "sku_id,week_start" });
        totalForecasts += rows.length;
      }
    }

    return { skus: pilotSkus.length, forecasts: totalForecasts };
  } catch (err) {
    return { skus: 0, forecasts: 0, error: err instanceof Error ? err.message : String(err) };
  }
}
