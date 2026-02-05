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
import { Bar, BarChart, XAxis } from "recharts";

export function ConversationsChart() {
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

  const chartData = [
    { day: "Mon", human: 45, ai: 120 },
    { day: "Tue", human: 52, ai: 135 },
    { day: "Wed", human: 38, ai: 98 },
    { day: "Thu", human: 65, ai: 145 },
    { day: "Fri", human: 48, ai: 110 },
    { day: "Sat", human: 25, ai: 75 },
    { day: "Sun", human: 18, ai: 55 }
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle>Conversations</CardTitle>
          <CardDescription>Human vs AI handled conversations this week</CardDescription>
        </div>
        <div className="flex gap-6 rounded-lg border px-4 py-2">
          <div className="flex flex-col gap-0.5 text-left">
            <span className="text-muted-foreground text-xs uppercase">Human</span>
            <span className="font-semibold text-lg">291</span>
          </div>
          <div className="flex flex-col gap-0.5 text-left">
            <span className="text-muted-foreground text-xs uppercase">AI</span>
            <span className="font-semibold text-lg">738</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <div>
          <ChartContainer className="h-[200px] w-full" config={chartConfig}>
            <BarChart
              accessibilityLayer
              data={chartData}
              margin={{
                left: -6,
                right: -6
              }}>
              <XAxis
                dataKey="day"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tickFormatter={(value) => value}
              />
              <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dashed" />} />
              <Bar dataKey="human" fill="var(--color-human)" radius={8} />
              <Bar dataKey="ai" fill="var(--color-ai)" radius={8} />
            </BarChart>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  );
}
