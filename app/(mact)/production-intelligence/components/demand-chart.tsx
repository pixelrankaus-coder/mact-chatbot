"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
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
import { Skeleton } from "@/components/ui/skeleton";

interface WeekProjection {
  week_start: string;
  forecast_demand: number;
  closing_stock: number;
}

interface SkuProjection {
  current_stock: number;
  weeks: WeekProjection[];
}

const chartConfig = {
  views: { label: "Projection" },
  demand: { label: "Demand", color: "var(--chart-1)" },
  stock: { label: "Closing Stock", color: "var(--chart-2)" },
} satisfies ChartConfig;

interface DemandChartProps {
  projections: SkuProjection[];
  loading: boolean;
}

export function DemandChart({ projections, loading }: DemandChartProps) {
  const [activeChart, setActiveChart] = React.useState<"demand" | "stock">("stock");

  // Per-week aggregate: total demand and total closing stock across all SKUs
  const chartData = React.useMemo(() => {
    if (!projections.length || !projections[0]?.weeks.length) return [];
    const weekCount = projections[0].weeks.length;
    return Array.from({ length: weekCount }, (_, i) => {
      const weekStart = projections[0].weeks[i].week_start;
      let demand = 0;
      let stock = 0;
      for (const p of projections) {
        if (p.weeks[i]) {
          demand += p.weeks[i].forecast_demand;
          stock += Math.max(0, p.weeks[i].closing_stock); // Don't let negative stock skew chart
        }
      }
      return { week: weekStart, demand: Math.round(demand), stock: Math.round(stock) };
    });
  }, [projections]);

  // Header stats: total current stock and avg weekly demand
  const headerStats = React.useMemo(() => {
    const totalCurrentStock = projections.reduce((s, p) => s + (p.current_stock || 0), 0);
    const avgWeeklyDemand = chartData.length > 0 ? chartData[0].demand : 0; // same every week for now
    return { totalCurrentStock, avgWeeklyDemand };
  }, [projections, chartData]);

  if (loading) {
    return (
      <Card className="relative h-full overflow-hidden">
        <CardHeader>
          <CardTitle>12-Week Outlook</CardTitle>
          <CardDescription>Aggregate demand &amp; stock projection</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[186px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative h-full overflow-hidden">
      <CardHeader>
        <CardTitle>12-Week Outlook</CardTitle>
        <CardDescription>Weekly aggregate across all pilot SKUs</CardDescription>
        <CardAction className="col-start-auto row-start-auto justify-self-start md:col-start-2 md:row-start-1 md:justify-self-end">
          <div className="end-0 top-0 flex divide-x rounded-md border-s border-e border-t border-b md:absolute md:rounded-none md:rounded-bl-md md:border-e-transparent md:border-t-transparent">
            <button
              data-active={activeChart === "stock"}
              className="data-[active=true]:bg-muted relative flex flex-1 flex-col justify-center gap-1 px-6 py-4 text-left"
              onClick={() => setActiveChart("stock")}
            >
              <span className="text-muted-foreground text-xs">Current Stock</span>
              <span className="font-display text-lg leading-none sm:text-2xl">
                {headerStats.totalCurrentStock.toLocaleString()}
              </span>
            </button>
            <button
              data-active={activeChart === "demand"}
              className="data-[active=true]:bg-muted relative flex flex-1 flex-col justify-center gap-1 px-6 py-4 text-left"
              onClick={() => setActiveChart("demand")}
            >
              <span className="text-muted-foreground text-xs">Wk Demand</span>
              <span className="font-display text-lg leading-none sm:text-2xl">
                {headerStats.avgWeeklyDemand.toLocaleString()}
              </span>
            </button>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[186px] w-full">
          <BarChart
            accessibilityLayer
            data={chartData}
            margin={{ left: 0, right: 0, bottom: 0 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="week"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value + "T00:00:00");
                return date.toLocaleDateString("en-AU", { month: "short", day: "numeric" });
              }}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  className="w-[180px]"
                  nameKey="views"
                  labelFormatter={(value) => {
                    const date = new Date(value + "T00:00:00");
                    return `Week of ${date.toLocaleDateString("en-AU", { month: "short", day: "numeric", year: "numeric" })}`;
                  }}
                  formatter={(value, name) => {
                    const label = name === "demand" ? "Forecast Demand" : "Closing Stock";
                    return [`${Number(value).toLocaleString()} units`, label];
                  }}
                />
              }
            />
            <Bar dataKey={activeChart} fill={`var(--color-${activeChart})`} radius={5} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
