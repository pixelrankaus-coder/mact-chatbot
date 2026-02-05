"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Coins, Zap, TrendingUp } from "lucide-react";

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
  dailyUsage: Array<{ date: string; tokens: number; cost: number; requests: number }>;
}

export function TokenUsageWidget() {
  const [stats, setStats] = useState<TokenStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"day" | "week" | "month">("month");

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch(`/api/stats/tokens?period=${period}`);
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error("Failed to fetch token stats:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [period]);

  const formatCost = (cost: number) => {
    if (cost < 0.01) {
      return `$${cost.toFixed(6)}`;
    }
    return `$${cost.toFixed(4)}`;
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(2)}M`;
    }
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}K`;
    }
    return tokens.toString();
  };

  if (loading) {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <Coins className="h-5 w-5 text-amber-600" />
            AI Token Usage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-32 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <Coins className="h-5 w-5 text-amber-600" />
            AI Token Usage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">No usage data available yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <Coins className="h-5 w-5 text-amber-600" />
            AI Token Usage
          </CardTitle>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as "day" | "week" | "month")}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600"
          >
            <option value="day">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-blue-600" />
              <span className="text-xs text-slate-500">Total Tokens</span>
            </div>
            <p className="mt-1 text-lg font-bold text-slate-900">
              {formatTokens(stats.summary.totalTokens)}
            </p>
          </div>

          <div className="rounded-lg bg-slate-50 p-3">
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-amber-600" />
              <span className="text-xs text-slate-500">Total Cost</span>
            </div>
            <p className="mt-1 text-lg font-bold text-slate-900">
              {formatCost(stats.summary.totalCost)}
            </p>
          </div>

          <div className="rounded-lg bg-slate-50 p-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="text-xs text-slate-500">Requests</span>
            </div>
            <p className="mt-1 text-lg font-bold text-slate-900">
              {stats.summary.requestCount}
            </p>
          </div>
        </div>

        {stats.summary.requestCount > 0 && (
          <div className="mt-4 border-t pt-4">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Avg tokens/request: {stats.summary.averageTokensPerRequest}</span>
              <span>Avg cost/request: {formatCost(stats.summary.averageCostPerRequest)}</span>
            </div>
          </div>
        )}

        {Object.keys(stats.byModel).length > 0 && (
          <div className="mt-4 border-t pt-4">
            <p className="mb-2 text-xs font-medium text-slate-500">By Model</p>
            <div className="space-y-2">
              {Object.entries(stats.byModel).map(([model, data]) => (
                <div key={model} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{model}</span>
                  <span className="text-slate-900">
                    {data.requests} req / {formatCost(data.cost)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
