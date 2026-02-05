/**
 * WooCommerce Sync Stream API (Server-Sent Events)
 * TASK MACT #035
 *
 * Provides real-time sync progress updates via SSE
 */

import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { syncWooOrdersWithLogging, syncWooCustomersWithLogging } from "@/lib/woo-sync-db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/sync/woocommerce/stream
 * Starts a WooCommerce sync and streams progress via SSE
 */
export async function POST(request: NextRequest) {
  const supabase = createServiceClient() as SupabaseAny;

  let syncType: "orders" | "customers" | "all" = "all";
  try {
    const body = await request.json();
    syncType = body.type || "all";
  } catch {
    // Default to "all"
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
        sendEvent("start", { type: syncType, timestamp: new Date().toISOString() });

        if (syncType === "orders" || syncType === "all") {
          sendEvent("log", { level: "info", message: "Starting WooCommerce orders sync...", timestamp: new Date().toISOString() });
          const ordersResult = await syncWooOrdersWithLogging(supabase, logCallback);
          sendEvent("result", {
            type: "orders",
            success: ordersResult.success,
            recordsSynced: ordersResult.recordsSynced,
            duration: ordersResult.duration,
            error: ordersResult.error,
          });
        }

        if (syncType === "customers" || syncType === "all") {
          sendEvent("log", { level: "info", message: "Starting WooCommerce customers sync...", timestamp: new Date().toISOString() });
          const customersResult = await syncWooCustomersWithLogging(supabase, logCallback);
          sendEvent("result", {
            type: "customers",
            success: customersResult.success,
            recordsSynced: customersResult.recordsSynced,
            duration: customersResult.duration,
            error: customersResult.error,
          });
        }

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
