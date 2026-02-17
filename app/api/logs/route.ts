import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

type SupabaseAny = ReturnType<typeof createServiceClient> & { from: (table: string) => any };

/**
 * GET /api/logs — Fetch system logs with filters
 *
 * Query params:
 *   level     — 'info' | 'warn' | 'error'
 *   category  — 'ai' | 'sync' | 'widget' | 'auth' | 'email' | 'cron' | 'settings' | 'health' | 'api'
 *   search    — text search on message field
 *   from      — ISO date string (start of range)
 *   to        — ISO date string (end of range)
 *   since     — ISO timestamp for incremental polling (returns logs newer than this)
 *   limit     — max rows (default 100, max 500)
 *   page      — pagination offset (default 1)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient() as SupabaseAny;
    const { searchParams } = new URL(request.url);

    const level = searchParams.get("level");
    const category = searchParams.get("category");
    const search = searchParams.get("search");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const since = searchParams.get("since");
    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 500);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const offset = (page - 1) * limit;

    let query = supabase
      .from("system_logs")
      .select("*", { count: "exact" })
      .order("timestamp", { ascending: false });

    if (level) {
      query = query.eq("level", level);
    }
    if (category) {
      query = query.eq("category", category);
    }
    if (search) {
      query = query.ilike("message", `%${search}%`);
    }
    if (since) {
      query = query.gt("timestamp", since);
    }
    if (from) {
      query = query.gte("timestamp", from);
    }
    if (to) {
      query = query.lte("timestamp", to);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      console.error("Failed to fetch system logs:", error);
      return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
    }

    return NextResponse.json({
      logs: data || [],
      total: count || 0,
      page,
      limit,
    });
  } catch (error) {
    console.error("Logs API error:", error);
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
}
