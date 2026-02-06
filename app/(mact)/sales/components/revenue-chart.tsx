"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { useRevenueData } from "@/hooks/use-dashboard-data";

const chartConfig = {
  views: {
    label: "Sales"
  },
  revenue: {
    label: "Revenue",
    color: "var(--chart-2)"
  },
  orders: {
    label: "Orders",
    color: "var(--chart-1)"
  }
} satisfies ChartConfig;

export function RevenueChart() {
  const { data, loading } = useRevenueData("28d");
  const [activeChart, setActiveChart] = React.useState<"revenue" | "orders">("revenue");

  // Transform data for chart
  const chartData = React.useMemo(() => {
    if (!data?.data) return [];
    return data.data.map((d) => ({
      date: d.date,
      revenue: d.revenue,
      orders: d.orders
    }));
  }, [data]);

  const total = React.useMemo(() => {
    if (!data?.summary) return { revenue: 0, orders: 0 };
    return {
      revenue: data.summary.totalRevenue,
      orders: data.summary.totalOrders
    };
  }, [data]);

  if (loading) {
    return (
      <Card className="relative h-full overflow-hidden">
        <CardHeader>
          <CardTitle>Revenue Chart</CardTitle>
          <CardDescription>Last 28 days</CardDescription>
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
        <CardTitle>Revenue Chart</CardTitle>
        <CardDescription>Last 28 days from Cin7</CardDescription>
        <CardAction className="col-start-auto row-start-auto justify-self-start md:col-start-2 md:row-start-1 md:justify-self-end">
          <div className="end-0 top-0 flex divide-x rounded-md border-s border-e border-t border-b md:absolute md:rounded-none md:rounded-bl-md md:border-e-transparent md:border-t-transparent">
            {(["revenue", "orders"] as const).map((key) => {
              return (
                <button
                  key={key}
                  data-active={activeChart === key}
                  className="data-[active=true]:bg-muted relative flex flex-1 flex-col justify-center gap-1 px-6 py-4 text-left"
                  onClick={() => setActiveChart(key)}>
                  <span className="text-muted-foreground text-xs">{chartConfig[key].label}</span>
                  <span className="font-display text-lg leading-none sm:text-2xl">
                    {key === "revenue"
                      ? `$${total.revenue.toLocaleString("en-AU", { maximumFractionDigits: 0 })}`
                      : total.orders.toLocaleString()}
                  </span>
                </button>
              );
            })}
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[186px] w-full">
          <BarChart
            accessibilityLayer
            data={chartData}
            margin={{
              left: 0,
              right: 0,
              bottom: 0
            }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString("en-AU", {
                  month: "short",
                  day: "numeric"
                });
              }}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  className="w-[150px]"
                  nameKey="views"
                  labelFormatter={(value) => {
                    return new Date(value).toLocaleDateString("en-AU", {
                      month: "short",
                      day: "numeric",
                      year: "numeric"
                    });
                  }}
                  formatter={(value, name) => {
                    if (name === "revenue") {
                      return [`$${Number(value).toLocaleString("en-AU", { minimumFractionDigits: 2 })}`, "Revenue"];
                    }
                    return [value, "Orders"];
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
