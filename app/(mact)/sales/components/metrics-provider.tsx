"use client";

import * as React from "react";
import { createContext, useContext } from "react";
import {
  useDashboardMetrics,
  type DashboardMetrics,
  formatCurrency,
} from "@/hooks/use-dashboard-data";
import { useDashboardSource } from "./dashboard-source-provider";

interface MetricsContextType {
  data: DashboardMetrics | null;
  loading: boolean;
  error: Error | null;
  formatCurrency: (value: number) => string;
}

const MetricsContext = createContext<MetricsContextType | null>(null);

export function MetricsProvider({ children }: { children: React.ReactNode }) {
  const { source } = useDashboardSource();
  const { data, loading, error } = useDashboardMetrics(source);

  return (
    <MetricsContext.Provider
      value={{
        data,
        loading,
        error,
        formatCurrency: (value: number) => formatCurrency(value, "AUD"),
      }}
    >
      {children}
    </MetricsContext.Provider>
  );
}

export function useMetrics() {
  const context = useContext(MetricsContext);
  if (!context) {
    throw new Error("useMetrics must be used within a MetricsProvider");
  }
  return context;
}
