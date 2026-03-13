"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  Play,
  Loader2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  Ban,
  Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ScheduleRun {
  id: string;
  sku_id: string;
  sku_code: string;
  sku_name: string;
  category: string | null;
  scheduled_date: string;
  recommended_qty: number;
  confirmed_qty: number | null;
  batch_count: number;
  sequence_order: number;
  status: string;
  blocking_reason: string | null;
  blocking_sku_id: string | null;
  notes: string | null;
  confirmed_by: string | null;
  completed_at: string | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
}

function formatDateFull(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
}

function isToday(dateStr: string): boolean {
  return dateStr === formatDate(new Date());
}

const STATUS_CONFIG: Record<string, { label: string; variant: "outline"; className: string; icon: React.ElementType }> = {
  pending: { label: "Pending", variant: "outline", className: "bg-slate-50 text-slate-700 border-slate-200", icon: Clock },
  confirmed: { label: "Confirmed", variant: "outline", className: "bg-blue-50 text-blue-700 border-blue-200", icon: CheckCircle2 },
  in_progress: { label: "In Progress", variant: "outline", className: "bg-amber-50 text-amber-700 border-amber-200", icon: Play },
  complete: { label: "Complete", variant: "outline", className: "bg-green-50 text-green-700 border-green-200", icon: CheckCircle2 },
  blocked: { label: "Blocked", variant: "outline", className: "bg-red-50 text-red-700 border-red-200", icon: AlertTriangle },
  cancelled: { label: "Cancelled", variant: "outline", className: "bg-gray-50 text-gray-400 border-gray-200", icon: Ban },
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function ScheduleBoardPage() {
  const [weekStart, setWeekStart] = useState<Date>(getMonday(new Date()));
  const [runs, setRuns] = useState<ScheduleRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchSchedule = useCallback(async () => {
    try {
      setLoading(true);
      const start = formatDate(weekStart);
      const end = formatDate(new Date(weekStart.getTime() + 6 * 86400000));

      const res = await fetch(`/api/production-intelligence/schedule?start=${start}&end=${end}`);
      if (res.ok) {
        const data = await res.json();
        setRuns(data.runs || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const runScheduler = async () => {
    setRunning(true);
    try {
      await fetch("/api/production-intelligence/schedule/run", { method: "POST" });
      await fetchSchedule();
    } catch {
      // ignore
    } finally {
      setRunning(false);
    }
  };

  const updateRunStatus = async (id: string, status: string) => {
    setUpdating(id);
    try {
      await fetch(`/api/production-intelligence/schedule/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await fetchSchedule();
    } catch {
      // ignore
    } finally {
      setUpdating(null);
    }
  };

  const prevWeek = () => setWeekStart((d) => new Date(d.getTime() - 7 * 86400000));
  const nextWeek = () => setWeekStart((d) => new Date(d.getTime() + 7 * 86400000));
  const thisWeek = () => setWeekStart(getMonday(new Date()));

  // Build day columns (Mon-Fri)
  const weekDays = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(weekStart.getTime() + i * 86400000);
    return formatDate(d);
  });

  // Group runs by day
  const runsByDay = new Map<string, ScheduleRun[]>();
  for (const day of weekDays) {
    runsByDay.set(day, []);
  }
  for (const run of runs) {
    const existing = runsByDay.get(run.scheduled_date);
    if (existing) existing.push(run);
  }

  // Summary stats
  const totalRuns = runs.length;
  const totalBatches = runs.reduce((s, r) => s + r.batch_count, 0);
  const blockedRuns = runs.filter((r) => r.status === "blocked").length;
  const completedRuns = runs.filter((r) => r.status === "complete").length;

  const weekLabel = `${formatDateFull(formatDate(weekStart))} — ${formatDateFull(weekDays[4])}`;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
            Production Schedule
          </h1>
          <p className="text-sm text-muted-foreground">{weekLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={runScheduler} disabled={running}>
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            <span className="hidden lg:inline">Run Scheduler</span>
          </Button>
          <Link href={`/production-intelligence/schedule/print?date=${formatDate(new Date())}`}>
            <Button variant="outline" size="sm">
              <Printer className="h-4 w-4" />
              <span className="hidden lg:inline">Print Today</span>
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={fetchSchedule} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Week navigation */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={prevWeek}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={thisWeek}>
          This Week
        </Button>
        <Button variant="outline" size="icon" onClick={nextWeek}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="space-y-1">
            <CardDescription>Total Runs</CardDescription>
            <div className="font-display text-2xl lg:text-3xl">{totalRuns}</div>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="space-y-1">
            <CardDescription>Total Batches</CardDescription>
            <div className="font-display text-2xl lg:text-3xl">{totalBatches}</div>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="space-y-1">
            <CardDescription>Blocked</CardDescription>
            <div className={`font-display text-2xl lg:text-3xl ${blockedRuns > 0 ? "text-red-600" : ""}`}>
              {blockedRuns}
            </div>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="space-y-1">
            <CardDescription>Completed</CardDescription>
            <div className={`font-display text-2xl lg:text-3xl ${completedRuns > 0 ? "text-green-600" : ""}`}>
              {completedRuns}
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Week board */}
      {loading ? (
        <div className="grid grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-[300px]" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          {weekDays.map((day) => {
            const dayRuns = runsByDay.get(day) || [];
            const today = isToday(day);
            const dayBatches = dayRuns.reduce((s, r) => s + r.batch_count, 0);

            return (
              <Card key={day} className={today ? "ring-2 ring-primary" : ""}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">
                      {formatDateShort(day)}
                    </CardTitle>
                    {today && (
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
                        Today
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-xs">
                    {dayRuns.length} runs · {dayBatches} batches
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {dayRuns.length === 0 ? (
                    <div className="py-4 text-center text-xs text-muted-foreground">
                      No runs scheduled
                    </div>
                  ) : (
                    dayRuns.map((run) => {
                      const config = STATUS_CONFIG[run.status] || STATUS_CONFIG.pending;
                      const StatusIcon = config.icon;
                      const qty = run.confirmed_qty ?? run.recommended_qty;

                      return (
                        <div
                          key={run.id}
                          className={`rounded-lg border p-2.5 text-xs space-y-1.5 ${
                            run.status === "blocked" ? "border-red-200 bg-red-50/50" :
                            run.status === "complete" ? "border-green-200 bg-green-50/50" :
                            run.status === "in_progress" ? "border-amber-200 bg-amber-50/50" :
                            ""
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <div className="font-medium leading-tight">
                              {run.sku_name}
                            </div>
                            <StatusIcon className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
                          </div>
                          <div className="text-muted-foreground">
                            {run.sku_code} · {run.batch_count}× batch · {qty} units
                          </div>
                          {run.category && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {run.category}
                            </Badge>
                          )}
                          {run.blocking_reason && (
                            <div className="flex items-center gap-1 text-red-600">
                              <XCircle className="h-3 w-3" />
                              <span className="truncate">{run.blocking_reason}</span>
                            </div>
                          )}
                          {/* Quick status actions */}
                          {run.status === "pending" && (
                            <div className="flex gap-1 pt-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-[10px] px-2"
                                onClick={() => updateRunStatus(run.id, "confirmed")}
                                disabled={updating === run.id}
                              >
                                {updating === run.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirm"}
                              </Button>
                            </div>
                          )}
                          {run.status === "confirmed" && (
                            <div className="flex gap-1 pt-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-[10px] px-2"
                                onClick={() => updateRunStatus(run.id, "in_progress")}
                                disabled={updating === run.id}
                              >
                                {updating === run.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Start"}
                              </Button>
                            </div>
                          )}
                          {run.status === "in_progress" && (
                            <div className="flex gap-1 pt-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-[10px] px-2 text-green-700"
                                onClick={() => updateRunStatus(run.id, "complete")}
                                disabled={updating === run.id}
                              >
                                {updating === run.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Complete"}
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
