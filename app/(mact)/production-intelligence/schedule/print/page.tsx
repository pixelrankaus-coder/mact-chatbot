"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Printer, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  notes: string | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDatePrint(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function DailyMakeListPage() {
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date") || formatDate(new Date());

  const [runs, setRuns] = useState<ScheduleRun[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRuns = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/production-intelligence/schedule?start=${dateParam}&end=${dateParam}`
      );
      if (res.ok) {
        const data = await res.json();
        setRuns(
          (data.runs || [])
            .filter((r: ScheduleRun) => r.status !== "cancelled")
            .sort((a: ScheduleRun, b: ScheduleRun) => a.sequence_order - b.sequence_order)
        );
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [dateParam]);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  const totalBatches = runs.reduce((s, r) => s + r.batch_count, 0);
  const totalUnits = runs.reduce(
    (s, r) => s + (r.confirmed_qty ?? r.recommended_qty),
    0
  );

  return (
    <div>
      {/* Print button — hidden when printing */}
      <div className="mb-4 flex items-center justify-between print:hidden">
        <h1 className="text-xl font-bold">Daily Make List</h1>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Print
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        /* Print layout */
        <div className="print:p-0">
          {/* Header */}
          <div className="mb-6 border-b-2 border-black pb-3">
            <div className="flex items-baseline justify-between">
              <h1 className="text-2xl font-bold">Daily Make List</h1>
              <span className="text-lg font-semibold">
                {formatDatePrint(dateParam)}
              </span>
            </div>
            <div className="mt-1 flex gap-6 text-sm text-muted-foreground">
              <span>{runs.length} production runs</span>
              <span>{totalBatches} total batches</span>
              <span>{totalUnits.toLocaleString()} total units</span>
            </div>
          </div>

          {runs.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No production runs scheduled for this date.
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-black">
                  <th className="py-2 text-left font-semibold w-8">#</th>
                  <th className="py-2 text-left font-semibold">Product</th>
                  <th className="py-2 text-left font-semibold">SKU</th>
                  <th className="py-2 text-left font-semibold">Category</th>
                  <th className="py-2 text-right font-semibold">Batches</th>
                  <th className="py-2 text-right font-semibold">Qty</th>
                  <th className="py-2 text-center font-semibold">Status</th>
                  <th className="py-2 text-left font-semibold">Notes</th>
                  <th className="py-2 text-center font-semibold w-16">Done</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run, i) => {
                  const qty = run.confirmed_qty ?? run.recommended_qty;
                  return (
                    <tr
                      key={run.id}
                      className={`border-b ${
                        run.status === "blocked" ? "bg-red-50" : ""
                      }`}
                    >
                      <td className="py-2 font-mono text-muted-foreground">
                        {i + 1}
                      </td>
                      <td className="py-2 font-medium">{run.sku_name}</td>
                      <td className="py-2 font-mono text-muted-foreground">
                        {run.sku_code}
                      </td>
                      <td className="py-2">{run.category || "—"}</td>
                      <td className="py-2 text-right font-mono">
                        {run.batch_count}
                      </td>
                      <td className="py-2 text-right font-mono font-semibold">
                        {qty}
                      </td>
                      <td className="py-2 text-center">
                        {run.status === "blocked" ? (
                          <span className="text-red-600 font-medium">
                            BLOCKED
                          </span>
                        ) : run.status === "complete" ? (
                          <span className="text-green-600 font-medium">
                            DONE
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            {run.status}
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-sm text-muted-foreground max-w-[200px] truncate">
                        {run.blocking_reason
                          ? `⚠ ${run.blocking_reason}`
                          : run.notes || ""}
                      </td>
                      <td className="py-2 text-center">
                        {/* Checkbox for print */}
                        <div className="inline-block h-5 w-5 border-2 border-gray-400 rounded" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-black font-semibold">
                  <td colSpan={4} className="py-2">
                    Total
                  </td>
                  <td className="py-2 text-right font-mono">{totalBatches}</td>
                  <td className="py-2 text-right font-mono">
                    {totalUnits.toLocaleString()}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          )}

          {/* Footer */}
          <div className="mt-8 border-t pt-3 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>
                Generated:{" "}
                {new Date().toLocaleString("en-AU", {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
              <span>MACt Production Intelligence</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
