"use client";

import * as React from "react";
import { createContext, useContext } from "react";

export type DashboardSource = "all" | "cin7" | "woocommerce";

interface DashboardSourceContextType {
  source: DashboardSource;
  setSource: (source: DashboardSource) => void;
}

const DashboardSourceContext = createContext<DashboardSourceContextType>({
  source: "cin7",
  setSource: () => {},
});

export function DashboardSourceProvider({ children }: { children: React.ReactNode }) {
  // Hardcoded to cin7 — all WooCommerce sales flow through Cin7
  return (
    <DashboardSourceContext.Provider value={{ source: "cin7", setSource: () => {} }}>
      {children}
    </DashboardSourceContext.Provider>
  );
}

export function useDashboardSource() {
  return useContext(DashboardSourceContext);
}

export function SourceToggle() {
  // No toggle needed — Cin7 only
  return null;
}
