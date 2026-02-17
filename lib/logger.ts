import { createServiceClient } from "@/lib/supabase";

export type LogLevel = "info" | "warn" | "error";

export type LogCategory =
  | "ai"
  | "sync"
  | "widget"
  | "auth"
  | "email"
  | "cron"
  | "settings"
  | "health"
  | "api";

interface LogEntry {
  level: LogLevel;
  category: LogCategory;
  message: string;
  path?: string;
  method?: string;
  status_code?: number;
  duration_ms?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Log a system activity event to the system_logs table.
 * Fire-and-forget — does not block the caller.
 *
 * Usage:
 *   logActivity({
 *     level: "info",
 *     category: "ai",
 *     message: "AI responded to customer chat using GPT-4o (1.2s, 450 tokens)",
 *     path: "/api/chat",
 *     method: "POST",
 *     status_code: 200,
 *     duration_ms: 1200,
 *     metadata: { model: "gpt-4o", tokens: 450, conversationId: "abc-123" }
 *   });
 */
export function logActivity(entry: LogEntry): void {
  // Fire-and-forget — we intentionally don't await this
  _writeLog(entry).catch((err) => {
    // Fallback to console so we never lose the log entirely
    console.error("[logger] Failed to write log:", err);
    console.log(`[${entry.level.toUpperCase()}] [${entry.category}] ${entry.message}`);
  });
}

async function _writeLog(entry: LogEntry): Promise<void> {
  const supabase = createServiceClient();

  const { error } = await (supabase as ReturnType<typeof createServiceClient>)
    .from("system_logs" as never)
    .insert({
      level: entry.level,
      category: entry.category,
      message: entry.message,
      path: entry.path || null,
      method: entry.method || null,
      status_code: entry.status_code || null,
      duration_ms: entry.duration_ms || null,
      metadata: entry.metadata || null,
    } as never);

  if (error) {
    throw error;
  }
}

// ── Convenience helpers ──────────────────────────────────────────

export function logInfo(category: LogCategory, message: string, extra?: Partial<LogEntry>): void {
  logActivity({ level: "info", category, message, ...extra });
}

export function logWarn(category: LogCategory, message: string, extra?: Partial<LogEntry>): void {
  logActivity({ level: "warn", category, message, ...extra });
}

export function logError(category: LogCategory, message: string, extra?: Partial<LogEntry>): void {
  logActivity({ level: "error", category, message, ...extra });
}
