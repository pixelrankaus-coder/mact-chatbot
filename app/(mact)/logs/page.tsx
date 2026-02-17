"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  ScrollText,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronRight,
  Search,
  Pause,
  Play,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

// ── Types ────────────────────────────────────────────────────────

interface SystemLog {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error";
  category: string;
  message: string;
  path: string | null;
  method: string | null;
  status_code: number | null;
  duration_ms: number | null;
  metadata: Record<string, unknown> | null;
}

interface LogStats {
  total: number;
  byLevel: Record<string, number>;
  byCategory: Record<string, number>;
}

// ── Constants ────────────────────────────────────────────────────

const CATEGORIES = [
  { value: "ai", label: "AI" },
  { value: "sync", label: "Sync" },
  { value: "widget", label: "Widget" },
  { value: "auth", label: "Auth" },
  { value: "email", label: "Email" },
  { value: "cron", label: "Cron" },
  { value: "settings", label: "Settings" },
  { value: "health", label: "Health" },
  { value: "api", label: "API" },
];

const LEVELS = [
  { value: "error", label: "Error", icon: AlertCircle, color: "text-red-600" },
  { value: "warn", label: "Warning", icon: AlertTriangle, color: "text-amber-600" },
  { value: "info", label: "Info", icon: Info, color: "text-blue-600" },
];

const LEVEL_STYLES: Record<string, string> = {
  error: "bg-red-50 border-l-4 border-l-red-500",
  warn: "bg-amber-50 border-l-4 border-l-amber-400",
  info: "bg-white border-l-4 border-l-transparent",
};

const LEVEL_BADGE: Record<string, string> = {
  error: "bg-red-100 text-red-700 border-red-200",
  warn: "bg-amber-100 text-amber-700 border-amber-200",
  info: "bg-blue-100 text-blue-700 border-blue-200",
};

const CATEGORY_COLORS: Record<string, string> = {
  ai: "bg-purple-100 text-purple-700",
  sync: "bg-cyan-100 text-cyan-700",
  widget: "bg-green-100 text-green-700",
  auth: "bg-orange-100 text-orange-700",
  email: "bg-pink-100 text-pink-700",
  cron: "bg-slate-100 text-slate-700",
  settings: "bg-indigo-100 text-indigo-700",
  health: "bg-emerald-100 text-emerald-700",
  api: "bg-sky-100 text-sky-700",
};

// ── Component ────────────────────────────────────────────────────

export default function SystemLogsPage() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 100;

  // Filters
  const [levelFilter, setLevelFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchInput, setSearchInput] = useState<string>("");

  // Auto-refresh
  const [autoRefresh, setAutoRefresh] = useState(false);
  const autoRefreshRef = useRef(autoRefresh);
  autoRefreshRef.current = autoRefresh;
  const latestTimestampRef = useRef<string | null>(null);

  // Expanded rows
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // ── Data fetching ──────────────────────────────────────────

  const fetchLogs = useCallback(
    async (opts?: { incremental?: boolean }) => {
      try {
        const params = new URLSearchParams();
        if (levelFilter) params.set("level", levelFilter);
        if (categoryFilter) params.set("category", categoryFilter);
        if (searchQuery) params.set("search", searchQuery);
        params.set("limit", String(limit));
        params.set("page", String(page));

        // Incremental: only fetch new logs since last timestamp
        if (opts?.incremental && latestTimestampRef.current) {
          params.set("since", latestTimestampRef.current);
        }

        const res = await fetch(`/api/logs?${params}`);
        const data = await res.json();

        if (res.ok) {
          if (opts?.incremental && data.logs.length > 0) {
            // Prepend new logs to existing list
            setLogs((prev) => {
              const existingIds = new Set(prev.map((l) => l.id));
              const newLogs = data.logs.filter((l: SystemLog) => !existingIds.has(l.id));
              return [...newLogs, ...prev];
            });
          } else if (!opts?.incremental) {
            setLogs(data.logs);
            setTotal(data.total);
          }

          // Track latest timestamp for incremental polling
          if (data.logs.length > 0) {
            latestTimestampRef.current = data.logs[0].timestamp;
          }
        }
      } catch (err) {
        console.error("Failed to fetch logs:", err);
      }
    },
    [levelFilter, categoryFilter, searchQuery, page]
  );

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/logs/stats");
      const data = await res.json();
      if (res.ok) setStats(data);
    } catch (err) {
      console.error("Failed to fetch log stats:", err);
    }
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    latestTimestampRef.current = null;
    await Promise.all([fetchLogs(), fetchStats()]);
    setRefreshing(false);
  };

  // Initial load
  useEffect(() => {
    setLoading(true);
    Promise.all([fetchLogs(), fetchStats()]).finally(() => setLoading(false));
  }, [fetchLogs, fetchStats]);

  // Auto-refresh polling
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      if (autoRefreshRef.current) {
        fetchLogs({ incremental: true });
        fetchStats();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs, fetchStats]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
    latestTimestampRef.current = null;
  }, [levelFilter, categoryFilter, searchQuery]);

  // ── Handlers ───────────────────────────────────────────────

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchInput);
  };

  const clearFilters = () => {
    setLevelFilter("");
    setCategoryFilter("");
    setSearchQuery("");
    setSearchInput("");
  };

  const hasFilters = levelFilter || categoryFilter || searchQuery;
  const totalPages = Math.ceil(total / limit);

  // ── Render ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex-1 overflow-auto bg-slate-50">
        <div className="border-b bg-white px-6 py-4">
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="p-6 space-y-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-slate-50">
      {/* ── Header ──────────────────────────────────────── */}
      <div className="border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900">
              <ScrollText className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">System Logs</h1>
              <p className="text-sm text-slate-500">
                Activity across the MACT platform
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={autoRefresh ? "default" : "outline"}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              {autoRefresh ? (
                <>
                  <Pause className="h-4 w-4 mr-1.5" />
                  Live
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-1.5" />
                  Live
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* ── Stats bar ───────────────────────────────────── */}
      {stats && (
        <div className="border-b bg-white px-6 py-3">
          <div className="flex items-center gap-6 text-sm">
            <span className="text-slate-500">
              Last 24h:
            </span>
            <span className="font-medium">{stats.total} events</span>
            {(stats.byLevel.error || 0) > 0 && (
              <span className="flex items-center gap-1 text-red-600 font-medium">
                <AlertCircle className="h-3.5 w-3.5" />
                {stats.byLevel.error} errors
              </span>
            )}
            {(stats.byLevel.warn || 0) > 0 && (
              <span className="flex items-center gap-1 text-amber-600 font-medium">
                <AlertTriangle className="h-3.5 w-3.5" />
                {stats.byLevel.warn} warnings
              </span>
            )}
            <span className="flex items-center gap-1 text-blue-600">
              <Info className="h-3.5 w-3.5" />
              {stats.byLevel.info || 0} info
            </span>
            <div className="ml-auto flex items-center gap-2">
              {Object.entries(stats.byCategory)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([cat, count]) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat === categoryFilter ? "" : cat)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-opacity ${
                      CATEGORY_COLORS[cat] || "bg-slate-100 text-slate-700"
                    } ${categoryFilter && categoryFilter !== cat ? "opacity-40" : ""}`}
                  >
                    {cat} ({count})
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Filters ─────────────────────────────────────── */}
      <div className="border-b bg-white px-6 py-3">
        <div className="flex items-center gap-3">
          {/* Level filter */}
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            <option value="">All Levels</option>
            {LEVELS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>

          {/* Category filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex-1 flex items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search logs..."
                className="pl-9 h-9"
              />
            </div>
            <Button type="submit" variant="outline" size="sm">
              Search
            </Button>
          </form>

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* ── Log list ────────────────────────────────────── */}
      <div className="p-4">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <ScrollText className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">No logs found</p>
            <p className="text-sm mt-1">
              {hasFilters
                ? "Try adjusting your filters"
                : "System activity will appear here as it happens"}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {/* Auto-refresh indicator */}
            {autoRefresh && (
              <div className="flex items-center gap-2 px-4 py-2 mb-2 rounded-lg bg-slate-900 text-white text-xs font-mono">
                <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                Live — refreshing every 5 seconds
              </div>
            )}

            {logs.map((log) => {
              const expanded = expandedIds.has(log.id);
              return (
                <div key={log.id} className={`rounded-lg border ${LEVEL_STYLES[log.level] || ""}`}>
                  {/* Main row */}
                  <button
                    onClick={() => toggleExpanded(log.id)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50/50 transition-colors"
                  >
                    {/* Expand indicator */}
                    {expanded ? (
                      <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />
                    )}

                    {/* Timestamp */}
                    <span className="text-xs font-mono text-slate-400 flex-shrink-0 w-[140px]">
                      {formatTimestamp(log.timestamp)}
                    </span>

                    {/* Level badge */}
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0 w-[52px] text-center ${
                        LEVEL_BADGE[log.level] || ""
                      }`}
                    >
                      {log.level}
                    </span>

                    {/* Category badge */}
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                        CATEGORY_COLORS[log.category] || "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {log.category}
                    </span>

                    {/* Message */}
                    <span className="text-sm text-slate-800 truncate flex-1 font-mono">
                      {log.message}
                    </span>

                    {/* Duration */}
                    {log.duration_ms != null && (
                      <span className="text-xs text-slate-400 font-mono flex-shrink-0">
                        {log.duration_ms >= 1000
                          ? `${(log.duration_ms / 1000).toFixed(1)}s`
                          : `${log.duration_ms}ms`}
                      </span>
                    )}

                    {/* Status code */}
                    {log.status_code != null && (
                      <Badge
                        variant="outline"
                        className={`text-[10px] flex-shrink-0 ${
                          log.status_code >= 400
                            ? "border-red-200 text-red-600"
                            : "border-green-200 text-green-600"
                        }`}
                      >
                        {log.status_code}
                      </Badge>
                    )}
                  </button>

                  {/* Expanded details */}
                  {expanded && (
                    <div className="px-4 pb-3 pt-1 ml-7 border-t border-slate-100">
                      <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs font-mono">
                        {log.path && (
                          <div>
                            <span className="text-slate-400">Path: </span>
                            <span className="text-slate-700">
                              {log.method && (
                                <span className="font-semibold">{log.method} </span>
                              )}
                              {log.path}
                            </span>
                          </div>
                        )}
                        {log.status_code != null && (
                          <div>
                            <span className="text-slate-400">Status: </span>
                            <span className="text-slate-700">{log.status_code}</span>
                          </div>
                        )}
                        {log.duration_ms != null && (
                          <div>
                            <span className="text-slate-400">Duration: </span>
                            <span className="text-slate-700">{log.duration_ms}ms</span>
                          </div>
                        )}
                        <div>
                          <span className="text-slate-400">Time: </span>
                          <span className="text-slate-700">
                            {new Date(log.timestamp).toLocaleString("en-AU")}
                          </span>
                        </div>
                      </div>

                      {/* Metadata */}
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <div className="mt-3">
                          <span className="text-xs text-slate-400 font-mono">Metadata:</span>
                          <pre className="mt-1 p-3 rounded-md bg-slate-900 text-green-400 text-xs overflow-x-auto font-mono">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Pagination ──────────────────────────────── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 px-2">
            <span className="text-sm text-slate-500">
              Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-slate-500">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  const secs = String(d.getSeconds()).padStart(2, "0");
  return `${month}-${day} ${hours}:${mins}:${secs}`;
}
