"use client";

import { useEffect, useState, useCallback } from "react";

export type DashboardSource = "all" | "cin7" | "woocommerce";

// Types for dashboard data
export interface DashboardMetrics {
  revenue: {
    value: number;
    change: number;
    period: string;
  };
  orders: {
    value: number;
    change: number;
    total: number;
  };
  customers: {
    total: number;
  };
  balance: {
    value: number;
    change?: number;
    label: string;
  };
  income: {
    value: number;
    change?: number;
    label: string;
  };
  expenses: {
    value: number;
    label: string;
  };
  tax: {
    value: number;
    label: string;
  };
}

export interface RecentOrder {
  id: string;
  orderNumber: string;
  customer: string;
  email: string;
  items: number;
  amount: number;
  currency: string;
  status: string;
  statusLabel: string;
  date: string;
  tracking: string | null;
  shippingStatus?: string | null;
  source?: "cin7" | "woocommerce";
}

export interface OrderStatusSummary {
  id: string;
  label: string;
  count: number;
  percentage: number;
  change: number;
}

export interface RevenueDataPoint {
  date: string;
  revenue: number;
  orders: number;
}

export interface RevenueData {
  data: RevenueDataPoint[];
  summary: {
    totalRevenue: number;
    totalOrders: number;
    avgDailyRevenue: number;
    peakDay: {
      date: string;
      revenue: number;
    };
  };
}

// Helper to build URL with source param
function withSource(url: string, source: DashboardSource): string {
  const sep = url.includes("?") ? "&" : "?";
  return source === "all" ? url : `${url}${sep}source=${source}`;
}

// Hook for dashboard metrics
export function useDashboardMetrics(source: DashboardSource = "all") {
  const [data, setData] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(withSource("/api/dashboard/sales/metrics", source));
      if (!response.ok) throw new Error("Failed to fetch metrics");
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [source]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

// Hook for recent orders
export function useRecentOrders(limit: number = 20, source: DashboardSource = "all") {
  const [orders, setOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(withSource(`/api/dashboard/sales/orders/recent?limit=${limit}`, source));
      if (!response.ok) throw new Error("Failed to fetch orders");
      const result = await response.json();
      setOrders(result.orders || []);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [limit, source]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { orders, loading, error, refetch: fetchData };
}

// Hook for order status distribution
export function useOrderStatus(source: DashboardSource = "all") {
  const [summary, setSummary] = useState<OrderStatusSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(withSource("/api/dashboard/sales/orders/status", source));
      if (!response.ok) throw new Error("Failed to fetch status");
      const result = await response.json();
      setSummary(result.summary || []);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [source]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { summary, loading, error, refetch: fetchData };
}

// Hook for revenue chart data
export function useRevenueData(period: string = "28d", source: DashboardSource = "all") {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(withSource(`/api/dashboard/sales/revenue?period=${period}`, source));
      if (!response.ok) throw new Error("Failed to fetch revenue data");
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [period, source]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

// Format currency helper
export function formatCurrency(value: number, currency: string = "AUD"): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// Format percentage helper
export function formatPercentage(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}
