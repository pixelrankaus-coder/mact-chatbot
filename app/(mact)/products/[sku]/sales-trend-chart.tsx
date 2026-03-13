"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const chartConfig = {
  revenue: {
    label: "Revenue",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

interface SalesTrendChartProps {
  data: { month: string; revenue: number; units: number }[];
}

export function SalesTrendChart({ data }: SalesTrendChartProps) {
  if (data.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Monthly Sales Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <BarChart
            accessibilityLayer
            data={data}
            margin={{ left: 0, right: 0, bottom: 0 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const [y, m] = value.split("-");
                const date = new Date(Number(y), Number(m) - 1);
                return date.toLocaleDateString("en-AU", {
                  month: "short",
                  year: "2-digit",
                });
              }}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  className="w-[150px]"
                  labelFormatter={(value) => {
                    const [y, m] = value.split("-");
                    const date = new Date(Number(y), Number(m) - 1);
                    return date.toLocaleDateString("en-AU", {
                      month: "long",
                      year: "numeric",
                    });
                  }}
                  formatter={(value) => [
                    `$${Number(value).toLocaleString("en-AU", { minimumFractionDigits: 2 })}`,
                    "Revenue",
                  ]}
                />
              }
            />
            <Bar dataKey="revenue" fill="var(--color-revenue)" radius={5} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
