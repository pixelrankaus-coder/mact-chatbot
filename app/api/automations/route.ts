import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any;

/**
 * GET /api/automations
 * Returns all order automations with filtering/pagination
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createServiceClient() as SupabaseAny;
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get("status") || "all";
    const type = searchParams.get("type") || "all";
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    let query = supabase
      .from("order_automations")
      .select("*", { count: "exact" })
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status !== "all") {
      query = query.eq("status", status);
    }
    if (type !== "all") {
      query = query.eq("automation_type", type);
    }

    const { data, count, error } = await query;

    if (error) {
      console.error("Automations fetch error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get summary counts
    const { data: summary } = await supabase
      .from("order_automations")
      .select("status, automation_type");

    const counts = {
      total: summary?.length || 0,
      active: summary?.filter((a: { status: string }) => a.status === "active").length || 0,
      paused: summary?.filter((a: { status: string }) => a.status === "paused").length || 0,
      completed: summary?.filter((a: { status: string }) => a.status === "completed").length || 0,
      quote_followup: summary?.filter((a: { automation_type: string }) => a.automation_type === "quote_followup").length || 0,
      cod_followup: summary?.filter((a: { automation_type: string }) => a.automation_type === "cod_followup").length || 0,
    };

    return NextResponse.json({
      automations: data || [],
      total: count || 0,
      counts,
    });
  } catch (error) {
    console.error("Automations API error:", error);
    return NextResponse.json({ error: "Failed to fetch automations" }, { status: 500 });
  }
}
