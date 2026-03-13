"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Database,
  ShoppingCart,
  Package,
  Layers,
  Truck,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ─── Types ──────────────────────────────────────────────────────────────────

interface SyncRun {
  id: string;
  sync_type: string;
  status: string;
  last_page: number;
  records_fetched: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface SyncStatus {
  sync_type: string;
  latest: SyncRun | null;
}

const SYNC_TYPE_META: Record<string, { label: string; description: string; icon: React.ElementType }> = {
  skus: {
    label: "Product SKUs",
    description: "Sync all active products from Cin7",
    icon: Package,
  },
  sales_history: {
    label: "Sales History",
    description: "6 months of sales data for pilot SKUs",
    icon: ShoppingCart,
  },
  stock_snapshot: {
    label: "Stock Snapshot",
    description: "Current inventory levels across all locations",
    icon: Database,
  },
  bom_items: {
    label: "Bill of Materials",
    description: "BOM components for pilot SKUs",
    icon: Layers,
  },
  purchase_orders: {
    label: "Purchase Orders",
    description: "Open/ordered purchase orders with line items",
    icon: Truck,
  },
};

// ─── Status Badge ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "complete":
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Complete
        </Badge>
      );
    case "running":
      return (
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Running
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
          <XCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      );
    case "paused":
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
          <Clock className="h-3 w-3 mr-1" />
          Paused
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-slate-500">
          <Clock className="h-3 w-3 mr-1" />
          Never Run
        </Badge>
      );
  }
}

// ─── Relative Time ──────────────────────────────────────────────────────────

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ─── Page Component ─────────────────────────────────────────────────────────

export default function ProductionIntelligencePage() {
  const [syncs, setSyncs] = useState<SyncStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningTypes, setRunningTypes] = useState<Set<string>>(new Set());
  const [pilotCount, setPilotCount] = useState(0);
  const [totalSkus, setTotalSkus] = useState(0);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/production-intelligence/sync");
      if (res.ok) {
        const data = await res.json();
        setSyncs(data.syncs || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSkuCounts = useCallback(async () => {
    try {
      const res = await fetch("/api/production-intelligence/skus");
      if (res.ok) {
        const data = await res.json();
        const skus = data.skus || [];
        setTotalSkus(skus.length);
        setPilotCount(skus.filter((s: { is_pilot: boolean }) => s.is_pilot).length);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchSkuCounts();
  }, [fetchStatus, fetchSkuCounts]);

  // Auto-refresh while any sync is running
  useEffect(() => {
    if (runningTypes.size === 0) return;
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [runningTypes.size, fetchStatus]);

  const triggerSync = async (type: string) => {
    setRunningTypes((prev) => new Set(prev).add(type));
    try {
      const res = await fetch("/api/production-intelligence/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (data.error) {
        console.error(`Sync ${type} error:`, data.error);
      }
    } catch (err) {
      console.error(`Sync ${type} failed:`, err);
    } finally {
      setRunningTypes((prev) => {
        const next = new Set(prev);
        next.delete(type);
        return next;
      });
      fetchStatus();
      if (type === "skus") fetchSkuCounts();
    }
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Production Intelligence</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Phase 1 — Pilot Data Sync from Cin7 Core
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchStatus} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total SKUs Synced</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalSkus}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pilot SKUs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pilotCount}</div>
              <p className="text-xs text-muted-foreground">Target: 10</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Sync Health</CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                const failed = syncs.filter((s) => s.latest?.status === "failed").length;
                const complete = syncs.filter((s) => s.latest?.status === "complete").length;
                if (failed > 0)
                  return (
                    <div className="flex items-center gap-2 text-red-600">
                      <AlertCircle className="h-5 w-5" />
                      <span className="text-2xl font-bold">{failed} failed</span>
                    </div>
                  );
                if (complete === syncs.length && syncs.length > 0)
                  return (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="text-2xl font-bold">All OK</span>
                    </div>
                  );
                return <div className="text-2xl font-bold text-slate-400">—</div>;
              })()}
            </CardContent>
          </Card>
        </div>

        {/* Sync Jobs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Data Sync Jobs</CardTitle>
            <CardDescription>
              Sync data from Cin7 Core. Each job is independent and resumable on failure.
              Run &quot;Product SKUs&quot; first to populate the SKU list.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Loading sync status...
              </div>
            ) : (
              Object.entries(SYNC_TYPE_META).map(([type, meta]) => {
                const sync = syncs.find((s) => s.sync_type === type);
                const latest = sync?.latest;
                const isRunning = runningTypes.has(type);
                const Icon = meta.icon;

                return (
                  <div
                    key={type}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-md bg-slate-100 flex items-center justify-center">
                        <Icon className="h-4.5 w-4.5 text-slate-600" />
                      </div>
                      <div>
                        <div className="font-medium text-sm">{meta.label}</div>
                        <div className="text-xs text-muted-foreground">{meta.description}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Stats */}
                      {latest && (
                        <div className="text-right text-xs text-muted-foreground space-y-0.5">
                          <div>{latest.records_fetched.toLocaleString()} records</div>
                          <div>{relativeTime(latest.completed_at || latest.started_at)}</div>
                        </div>
                      )}

                      {/* Status */}
                      <StatusBadge status={latest?.status || "never"} />

                      {/* Error tooltip */}
                      {latest?.error_message && (
                        <span className="text-xs text-red-500 max-w-[200px] truncate" title={latest.error_message}>
                          {latest.error_message}
                        </span>
                      )}

                      {/* Trigger button */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => triggerSync(type)}
                        disabled={isRunning}
                      >
                        {isRunning ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Play className="h-3.5 w-3.5" />
                        )}
                        <span className="ml-1.5">{isRunning ? "Running..." : "Run"}</span>
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Getting Started</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              <strong>Step 1:</strong> Run &quot;Product SKUs&quot; sync to pull all active products from Cin7.
            </p>
            <p>
              <strong>Step 2:</strong> Mark the top 10 revenue SKUs as pilot (via the SKU management page — coming soon, or directly in Supabase).
            </p>
            <p>
              <strong>Step 3:</strong> Run &quot;Sales History&quot;, &quot;Stock Snapshot&quot;, &quot;Bill of Materials&quot;, and &quot;Purchase Orders&quot; syncs.
              These will only process pilot SKUs.
            </p>
            <p>
              <strong>Step 4:</strong> Verify data in Supabase tables (pi_sales_history, pi_stock_snapshots, etc).
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
