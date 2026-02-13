"use client";

import {
  Card,
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
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

interface ConversationsChartProps {
  data?: Array<{ date: string; human: number; ai: number }>;
  loading?: boolean;
}

export function ConversationsChart({ data, loading }: ConversationsChartProps) {
  const chartConfig = {
    human: {
      label: "Human",
      color: "var(--chart-1)"
    },
    ai: {
      label: "AI",
      color: "var(--chart-2)"
    }
  } satisfies ChartConfig;

  const totalHuman = data?.reduce((s, d) => s + d.human, 0) ?? 0;
  const totalAi = data?.reduce((s, d) => s + d.ai, 0) ?? 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle>Conversations</CardTitle>
          <CardDescription>Human vs AI handled conversations</CardDescription>
        </div>
        <div className="flex gap-6 rounded-lg border px-4 py-2">
          <div className="flex flex-col gap-0.5 text-left">
            <span className="text-muted-foreground text-xs uppercase">Human</span>
            <span className="font-semibold text-lg">{loading ? "-" : totalHuman}</span>
          </div>
          <div className="flex flex-col gap-0.5 text-left">
            <span className="text-muted-foreground text-xs uppercase">AI</span>
            <span className="font-semibold text-lg">{loading ? "-" : totalAi}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        {loading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : data && data.length > 0 ? (
          <ChartContainer className="h-[200px] w-full" config={chartConfig}>
            <BarChart
              accessibilityLayer
              data={data}
              margin={{ left: -6, right: -6 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return date.toLocaleDateString("en-AU", { month: "short", day: "numeric" });
                }}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    indicator="dashed"
                    labelFormatter={(value) => {
                      return new Date(value).toLocaleDateString("en-AU", {
                        month: "short",
                        day: "numeric",
                        year: "numeric"
                      });
                    }}
                  />
                }
              />
              <Bar dataKey="human" fill="var(--color-human)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="ai" fill="var(--color-ai)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
            No conversations in this period
          </div>
        )}
      </CardContent>
    </Card>
  );
}
