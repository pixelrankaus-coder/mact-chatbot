"use client";

import * as React from "react";
import { createContext, useContext, useState } from "react";
import { Badge } from "@/components/ui/badge";

export type DashboardSource = "all" | "cin7" | "woocommerce";

interface DashboardSourceContextType {
  source: DashboardSource;
  setSource: (source: DashboardSource) => void;
}

const DashboardSourceContext = createContext<DashboardSourceContextType>({
  source: "all",
  setSource: () => {},
});

export function DashboardSourceProvider({ children }: { children: React.ReactNode }) {
  const [source, setSource] = useState<DashboardSource>("all");

  return (
    <DashboardSourceContext.Provider value={{ source, setSource }}>
      {children}
    </DashboardSourceContext.Provider>
  );
}

export function useDashboardSource() {
  return useContext(DashboardSourceContext);
}

const sourceLabels: Record<DashboardSource, string> = {
  all: "All",
  cin7: "Cin7",
  woocommerce: "WooCommerce",
};

export function SourceToggle() {
  const { source, setSource } = useDashboardSource();

  return (
    <div className="flex items-center gap-1 rounded-lg border bg-muted/50 p-1">
      {(["all", "cin7", "woocommerce"] as DashboardSource[]).map((s) => (
        <button
          key={s}
          onClick={() => setSource(s)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            source === s
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {sourceLabels[s]}
        </button>
      ))}
    </div>
  );
}
