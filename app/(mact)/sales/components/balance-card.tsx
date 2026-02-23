"use client";

import { ArrowUpIcon, ArrowDownIcon } from "lucide-react";
import { Card, CardDescription, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMetrics } from "./metrics-provider";

export function BalanceCard() {
  const { data, loading, formatCurrency } = useMetrics();

  if (loading) {
    return (
      <Card>
        <CardHeader className="space-y-1">
          <CardDescription>Total Balance</CardDescription>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
      </Card>
    );
  }

  const value = data?.balance?.value ?? 0;
  const change = data?.balance?.change ?? data?.revenue?.change ?? 0;
  const isPositive = change >= 0;

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardDescription>Outstanding Orders</CardDescription>
        <div className="font-display text-2xl lg:text-3xl">
          {formatCurrency(value)}
        </div>
        <div className="flex items-center text-xs">
          {isPositive ? (
            <ArrowUpIcon className="mr-1 size-3 text-green-500" />
          ) : (
            <ArrowDownIcon className="mr-1 size-3 text-red-500" />
          )}
          <span className={`font-medium ${isPositive ? "text-green-500" : "text-red-500"}`}>
            {Math.abs(change).toFixed(1)}%
          </span>
          <span className="text-muted-foreground ml-1">vs last 30 days</span>
        </div>
      </CardHeader>
    </Card>
  );
}
