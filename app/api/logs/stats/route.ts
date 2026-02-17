import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

type SupabaseAny = ReturnType<typeof createServiceClient> & { from: (table: string) => any };

/**
 * GET /api/logs/stats — Summary counts for the logs dashboard header
 *
 * Returns counts by level and category for the last 24 hours.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient() as SupabaseAny;
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Fetch all logs from last 24h (just level + category for counting)
    const { data, error } = await supabase
      .from("system_logs")
      .select("level, category")
      .gte("timestamp", twentyFourHoursAgo);

    if (error) {
      // Table doesn't exist yet — return empty stats instead of 500
      if (error.code === "42P01" || error.message?.includes("relation") || error.code === "PGRST116") {
        return NextResponse.json({ total: 0, byLevel: { info: 0, warn: 0, error: 0 }, byCategory: {}, period: "24h" });
      }
      console.error("Failed to fetch log stats:", error);
      return NextResponse.json({ error: "Failed to fetch log stats" }, { status: 500 });
    }

    const logs = data || [];

    // Count by level
    const byLevel: Record<string, number> = { info: 0, warn: 0, error: 0 };
    for (const log of logs) {
      byLevel[log.level] = (byLevel[log.level] || 0) + 1;
    }

    // Count by category
    const byCategory: Record<string, number> = {};
    for (const log of logs) {
      byCategory[log.category] = (byCategory[log.category] || 0) + 1;
    }

    return NextResponse.json({
      total: logs.length,
      byLevel,
      byCategory,
      period: "24h",
    });
  } catch (error) {
    console.error("Log stats API error:", error);
    return NextResponse.json({ error: "Failed to fetch log stats" }, { status: 500 });
  }
}
