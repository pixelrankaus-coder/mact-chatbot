"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

interface HistoricalWeek {
  week_start: string;
  qty: number;
}

interface ProjectionWeek {
  week_start: string;
  forecast_demand: number;
  closing_stock: number;
}

interface UnifiedForecastChartProps {
  historicalSales: HistoricalWeek[];
  projectionWeeks: ProjectionWeek[];
  currentStock: number;
  safetyStock: number;
}

interface ChartEntry {
  week: string;
  actual?: number;
  forecast?: number;
  closing_stock?: number;
}

const chartConfig = {
  actual: { label: "Actual Sales", color: "var(--chart-3)" },
  forecast: { label: "Forecast", color: "var(--chart-1)" },
  closing_stock: { label: "Closing Stock", color: "var(--chart-2)" },
} satisfies ChartConfig;

export function UnifiedForecastChart({
  historicalSales,
  projectionWeeks,
  currentStock,
  safetyStock,
}: UnifiedForecastChartProps) {
  // Build combined 24-entry data array
  const chartData: ChartEntry[] = [];

  // Past weeks (actual sales)
  for (const w of historicalSales) {
    chartData.push({
      week: w.week_start,
      actual: Math.round(w.qty),
    });
  }

  // Future weeks (forecast + closing stock)
  for (const w of projectionWeeks) {
    chartData.push({
      week: w.week_start,
      forecast: Math.round(w.forecast_demand * 10) / 10,
      closing_stock: Math.round(w.closing_stock),
    });
  }

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sales & Forecast</CardTitle>
          <CardDescription>No data available yet</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Find "today" position — the week boundary between past and future
  const todayWeek = projectionWeeks.length > 0 ? projectionWeeks[0].week_start : null;

  // Wk 12 closing stock
  const wk12Stock = projectionWeeks.length > 0
    ? Math.round(projectionWeeks[projectionWeeks.length - 1].closing_stock)
    : 0;

  return (
    <Card className="relative overflow-hidden">
      <CardHeader>
        <CardTitle>Sales & Forecast</CardTitle>
        <CardDescription>Past 12 weeks actual vs next 12 weeks forecast</CardDescription>
        <CardAction className="col-start-auto row-start-auto justify-self-start md:col-start-2 md:row-start-1 md:justify-self-end">
          <div className="end-0 top-0 flex divide-x rounded-md border-s border-e border-t border-b md:absolute md:rounded-none md:rounded-bl-md md:border-e-transparent md:border-t-transparent">
            <div className="flex flex-col justify-center gap-1 px-6 py-4 text-left">
              <span className="text-muted-foreground text-xs">Current Stock</span>
              <span className="font-display text-lg leading-none sm:text-2xl">
                {currentStock.toLocaleString()}
              </span>
            </div>
            <div className="flex flex-col justify-center gap-1 px-6 py-4 text-left">
              <span className="text-muted-foreground text-xs">Wk 12</span>
              <span className={`font-display text-lg leading-none sm:text-2xl ${wk12Stock <= 0 ? "text-red-600" : ""}`}>
                {wk12Stock.toLocaleString()}
              </span>
            </div>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[260px] w-full">
          <ComposedChart
            data={chartData}
            margin={{ left: 0, right: 0, bottom: 0, top: 8 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="week"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={40}
              tickFormatter={(value) => {
                const date = new Date(value + "T00:00:00");
                return date.toLocaleDateString("en-AU", { month: "short", day: "numeric" });
              }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              width={40}
            />

            {/* Reference lines */}
            <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
            {safetyStock > 0 && (
              <ReferenceLine y={safetyStock} stroke="#f59e0b" strokeDasharray="3 3" />
            )}

            {/* Today divider */}
            {todayWeek && (
              <ReferenceLine
                x={todayWeek}
                stroke="#888"
                strokeDasharray="4 4"
                label={{ value: "Today", position: "top", fill: "#888", fontSize: 11 }}
              />
            )}

            <ChartTooltip
              content={
                <ChartTooltipContent
                  className="w-[180px]"
                  labelFormatter={(value) => {
                    const date = new Date(value + "T00:00:00");
                    return `Week of ${date.toLocaleDateString("en-AU", { month: "short", day: "numeric", year: "numeric" })}`;
                  }}
                  formatter={(value, name) => {
                    if (value === null || value === undefined) return null;
                    const labels: Record<string, string> = {
                      actual: "Actual Sales",
                      forecast: "Forecast",
                      closing_stock: "Closing Stock",
                    };
                    return [`${Number(value).toLocaleString()} units`, labels[name as string] || String(name)];
                  }}
                />
              }
            />

            {/* Actual sales bars (past - green) */}
            <Bar
              dataKey="actual"
              fill="var(--color-actual)"
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
            />

            {/* Forecast bars (future - blue/muted) */}
            <Bar
              dataKey="forecast"
              fill="var(--color-forecast)"
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
              opacity={0.7}
            />

            {/* Closing stock line (future only) */}
            <Line
              type="monotone"
              dataKey="closing_stock"
              stroke="var(--color-closing_stock)"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--color-closing_stock)" }}
            />
          </ComposedChart>
        </ChartContainer>

        {/* Legend */}
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "var(--chart-3)" }} />
            Actual Sales
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "var(--chart-1)" }} />
            Forecast
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-0.5 w-4 rounded" style={{ backgroundColor: "var(--chart-2)" }} />
            Closing Stock
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
