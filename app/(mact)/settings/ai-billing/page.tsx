"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ArrowLeft,
  DollarSign,
  Zap,
  Hash,
  TrendingUp,
  ExternalLink,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";

interface TokenStats {
  period: string;
  summary: {
    totalPromptTokens: number;
    totalCompletionTokens: number;
    totalTokens: number;
    totalCost: number;
    requestCount: number;
    averageTokensPerRequest: number;
    averageCostPerRequest: number;
  };
  byModel: Record<string, { requests: number; tokens: number; cost: number }>;
  dailyUsage: Array<{
    date: string;
    tokens: number;
    cost: number;
    requests: number;
  }>;
}

interface ProviderBilling {
  provider: string;
  available: boolean;
  balance?: number;
  currency?: string;
  message?: string;
  dashboardUrl: string;
}

const periodMap: Record<string, string> = {
  today: "day",
  "7d": "week",
  "30d": "month",
  all: "all",
};

const chartConfig = {
  cost: {
    label: "Cost",
    color: "var(--chart-1)",
  },
  requests: {
    label: "Requests",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

export default function AIBillingPage() {
  const [period, setPeriod] = useState("30d");
  const [stats, setStats] = useState<TokenStats | null>(null);
  const [providers, setProviders] = useState<ProviderBilling[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingLoading, setBillingLoading] = useState(true);

  const fetchStats = async (p: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/stats/tokens?period=${periodMap[p]}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error("Failed to fetch token stats:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchBilling = async () => {
    setBillingLoading(true);
    try {
      const res = await fetch("/api/stats/ai-billing");
      if (res.ok) {
        const data = await res.json();
        setProviders(data.providers || []);
      }
    } catch (e) {
      console.error("Failed to fetch billing:", e);
    } finally {
      setBillingLoading(false);
    }
  };

  useEffect(() => {
    fetchStats(period);
  }, [period]);

  useEffect(() => {
    fetchBilling();
  }, []);

  const modelRows = useMemo(() => {
    if (!stats?.byModel) return [];
    return Object.entries(stats.byModel)
      .map(([model, data]) => ({ model, ...data }))
      .sort((a, b) => b.cost - a.cost);
  }, [stats]);

  const formatCost = (cost: number) => {
    if (cost === 0) return "$0.00";
    if (cost < 0.01) return `$${cost.toFixed(6)}`;
    if (cost < 1) return `$${cost.toFixed(4)}`;
    return `$${cost.toFixed(2)}`;
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
    if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
    return tokens.toString();
  };

  return (
    <div className="flex-1 overflow-auto bg-slate-50">
      <div className="p-6 max-w-6xl">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Link href="/settings">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100">
            <DollarSign className="h-5 w-5 text-green-600" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              AI Billing
            </h1>
            <p className="text-sm text-slate-500">
              Monitor AI spending and token usage across providers
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchStats(period);
              fetchBilling();
            }}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>

        {/* Period Selector */}
        <Tabs value={period} onValueChange={setPeriod} className="mb-6">
          <TabsList>
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="7d">7 Days</TabsTrigger>
            <TabsTrigger value="30d">30 Days</TabsTrigger>
            <TabsTrigger value="all">All Time</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Summary Cards */}
        {loading ? (
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">
                  Total Cost
                </CardTitle>
                <DollarSign className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCost(stats?.summary.totalCost || 0)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">
                  Total Tokens
                </CardTitle>
                <Zap className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatTokens(stats?.summary.totalTokens || 0)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">
                  Total Requests
                </CardTitle>
                <Hash className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats?.summary.requestCount || 0}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">
                  Avg Cost/Request
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCost(stats?.summary.averageCostPerRequest || 0)}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Cost Over Time Chart */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Cost Over Time</CardTitle>
            <CardDescription>
              Daily AI spending and request volume
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : stats?.dailyUsage && stats.dailyUsage.length > 0 ? (
              <ChartContainer
                config={chartConfig}
                className="h-[250px] w-full"
              >
                <BarChart
                  accessibilityLayer
                  data={stats.dailyUsage}
                  margin={{ left: 0, right: 0, bottom: 0 }}
                >
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
                        day: "numeric",
                      });
                    }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(value) => formatCost(value)}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        className="w-[180px]"
                        labelFormatter={(value) => {
                          return new Date(value).toLocaleDateString("en-AU", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          });
                        }}
                        formatter={(value, name) => {
                          if (name === "cost") {
                            return [formatCost(Number(value)), "Cost"];
                          }
                          return [value, "Requests"];
                        }}
                      />
                    }
                  />
                  <Bar
                    dataKey="cost"
                    fill="var(--color-cost)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex h-[250px] items-center justify-center text-sm text-slate-400">
                No usage data for this period
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Usage by Model */}
          <Card>
            <CardHeader>
              <CardTitle>Usage by Model</CardTitle>
              <CardDescription>
                Breakdown of requests, tokens, and cost per model
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : modelRows.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Model</TableHead>
                      <TableHead className="text-right">Requests</TableHead>
                      <TableHead className="text-right">Tokens</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modelRows.map((row) => (
                      <TableRow key={row.model}>
                        <TableCell className="font-medium">
                          {row.model}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.requests}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatTokens(row.tokens)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCost(row.cost)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex h-[200px] items-center justify-center text-sm text-slate-400">
                  No usage data for this period
                </div>
              )}
            </CardContent>
          </Card>

          {/* Provider Billing */}
          <Card>
            <CardHeader>
              <CardTitle>Provider Accounts</CardTitle>
              <CardDescription>
                Live balance and billing dashboard links
              </CardDescription>
            </CardHeader>
            <CardContent>
              {billingLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {providers.map((p) => (
                    <div
                      key={p.provider}
                      className="flex items-center justify-between rounded-lg border border-slate-200 p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
                          <img
                            src={`/images/providers/${p.provider}.svg`}
                            alt={p.provider}
                            className="h-5 w-5"
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium capitalize">
                              {p.provider}
                            </span>
                            {p.available && p.balance !== undefined && (
                              <Badge variant="secondary" className="text-xs">
                                {p.currency === "CNY" ? "¥" : "$"}
                                {p.balance.toFixed(2)} {p.currency}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-slate-500">{p.message}</p>
                        </div>
                      </div>
                      <a
                        href={p.dashboardUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="ghost" size="sm">
                          Dashboard
                          <ExternalLink className="ml-1 h-3 w-3" />
                        </Button>
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
