"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";

interface StockProjectionChartProps {
  weeks: Array<{
    week_start: string;
    closing_stock: number;
    risk_flag: "STOCKOUT_RISK" | "PROJECTED_STOCKOUT" | null;
  }>;
  safetyStock: number;
}

const chartConfig = {
  closing_stock: { label: "Closing Stock", color: "#22C55E" },
} satisfies ChartConfig;

function getBarColor(closingStock: number, safetyStock: number): string {
  if (closingStock < 0) return "#EF4444";
  if (closingStock < safetyStock) return "#F59E0B";
  return "#22C55E";
}

function getStatus(closingStock: number, safetyStock: number): string {
  if (closingStock < 0) return "Stockout";
  if (closingStock < safetyStock) return "Below safety stock";
  return "Healthy";
}

export function StockProjectionChart({
  weeks,
  safetyStock,
}: StockProjectionChartProps) {
  const chartData = weeks.map((w) => ({
    week: w.week_start,
    closing_stock: Math.round(w.closing_stock),
  }));

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>12-Week Stock Projection</CardTitle>
          <CardDescription>No projection data available</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>12-Week Stock Projection</CardTitle>
        <CardDescription>Projected closing stock by week</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[220px] w-full">
          <BarChart
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
              width={50}
            />

            {safetyStock > 0 && (
              <ReferenceLine
                y={safetyStock}
                stroke="#6B7280"
                strokeDasharray="4 4"
                label={{ value: "Safety stock", position: "right", fill: "#6B7280", fontSize: 11 }}
              />
            )}

            <ChartTooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const data = payload[0].payload;
                const qty = data.closing_stock;
                const date = new Date(data.week + "T00:00:00");
                const label = date.toLocaleDateString("en-AU", { month: "short", day: "numeric", year: "numeric" });
                const status = getStatus(qty, safetyStock);
                return (
                  <div className="rounded-lg border bg-background px-3 py-2 text-sm shadow-sm">
                    <div className="font-medium">Week of {label}</div>
                    <div className="text-muted-foreground">
                      {qty.toLocaleString()} units — {status}
                    </div>
                  </div>
                );
              }}
            />

            <Bar dataKey="closing_stock" radius={[4, 4, 0, 0]} maxBarSize={28}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getBarColor(entry.closing_stock, safetyStock)}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>

        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "#22C55E" }} />
            Healthy
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "#F59E0B" }} />
            Below Safety
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "#EF4444" }} />
            Stockout
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
