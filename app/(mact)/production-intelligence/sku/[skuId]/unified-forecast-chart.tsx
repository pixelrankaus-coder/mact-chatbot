"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
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
}

const chartConfig = {
  actual: { label: "Actual Sales", color: "#1E3A5F" },
  forecast: { label: "Forecast", color: "#93C5FD" },
} satisfies ChartConfig;

export function UnifiedForecastChart({
  historicalSales,
  projectionWeeks,
  currentStock,
  safetyStock,
}: UnifiedForecastChartProps) {
  const chartData: ChartEntry[] = [];

  for (const w of historicalSales) {
    chartData.push({
      week: w.week_start,
      actual: Math.round(w.qty),
    });
  }

  for (const w of projectionWeeks) {
    chartData.push({
      week: w.week_start,
      forecast: Math.round(w.forecast_demand * 10) / 10,
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

  const todayWeek = projectionWeeks.length > 0 ? projectionWeeks[0].week_start : null;

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

            {safetyStock > 0 && (
              <ReferenceLine y={safetyStock} stroke="#f59e0b" strokeDasharray="3 3" />
            )}

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
                  formatter={(value, name) => {
                    if (value === null || value === undefined) return null;
                    const labels: Record<string, string> = {
                      actual: "Actual Sales",
                      forecast: "Forecast",
                    };
                    return [`${Number(value).toLocaleString()} units \u00b7 ${labels[name as string] || String(name)}`];
                  }}
                />
              }
            />

            <Bar
              dataKey="actual"
              fill="#1E3A5F"
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
              opacity={1}
            />

            <Bar
              dataKey="forecast"
              fill="#93C5FD"
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
              opacity={0.7}
            />
          </ComposedChart>
        </ChartContainer>

        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "#1E3A5F" }} />
            Actual Sales
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "#93C5FD" }} />
            Forecast
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
