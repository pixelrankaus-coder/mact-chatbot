/**
 * Cin7 Sync Stream API (Server-Sent Events)
 * TASK MACT #036, #039
 *
 * Provides real-time sync progress updates via SSE
 * Supports sync mode: 'full' (all data) or 'incremental' (last 30 days)
 */

import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import {
  syncCin7OrdersWithLogging,
  syncCin7CustomersWithLogging,
  updateCin7SyncSettings,
  SyncMode,
} from "@/lib/cin7-sync-db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/sync/cin7/stream
 * Starts a Cin7 sync and streams progress via SSE
 * Body: { type: "orders" | "customers" | "all", mode: "full" | "incremental" }
 */
export async function POST(request: NextRequest) {
  const supabase = createServiceClient() as SupabaseAny;

  let syncType: "orders" | "customers" | "all" = "all";
  let syncMode: SyncMode = "full";
  try {
    const body = await request.json();
    syncType = body.type || "all";
    syncMode = body.mode || "full";
  } catch {
    // Default to "all" and "full"
  }

  // Create a readable stream for SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Helper to send SSE events
      const sendEvent = (event: string, data: unknown) => {
        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      // Logging callback
      const logCallback = async (
        level: "info" | "warn" | "error" | "success",
        message: string,
        details?: Record<string, unknown>
      ) => {
        sendEvent("log", { level, message, details, timestamp: new Date().toISOString() });
      };

      try {
        sendEvent("start", { type: syncType, mode: syncMode, timestamp: new Date().toISOString() });

        let ordersCount = 0;
        let customersCount = 0;

        if (syncType === "orders" || syncType === "all") {
          sendEvent("log", { level: "info", message: `Starting Cin7 orders sync (${syncMode} mode)...`, timestamp: new Date().toISOString() });
          const ordersResult = await syncCin7OrdersWithLogging(supabase, logCallback, syncMode);
          ordersCount = ordersResult.recordsSynced;
          sendEvent("result", {
            type: "orders",
            success: ordersResult.success,
            recordsSynced: ordersResult.recordsSynced,
            duration: ordersResult.duration,
            error: ordersResult.error,
          });
        }

        if (syncType === "customers" || syncType === "all") {
          sendEvent("log", { level: "info", message: "Starting Cin7 customers sync...", timestamp: new Date().toISOString() });
          const customersResult = await syncCin7CustomersWithLogging(supabase, logCallback);
          customersCount = customersResult.recordsSynced;
          sendEvent("result", {
            type: "customers",
            success: customersResult.success,
            recordsSynced: customersResult.recordsSynced,
            duration: customersResult.duration,
            error: customersResult.error,
          });
        }

        // Update sync settings with counts and timestamp
        await updateCin7SyncSettings(supabase, {
          last_sync_at: new Date().toISOString(),
          ...(ordersCount > 0 && { orders_cached: ordersCount }),
          ...(customersCount > 0 && { customers_cached: customersCount }),
        });

        sendEvent("complete", { timestamp: new Date().toISOString() });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        sendEvent("error", { message: errorMessage, timestamp: new Date().toISOString() });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
