import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

/**
 * GET /api/production-intelligence/sync/history?type=skus&limit=10
 * Returns sync run history for a given type
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);

    let query = supabase
      .from("pi_sync_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (type) {
      query = query.eq("sync_type", type);
    }

    const { data, error } = await query;

    if (error) {
      if (error.code === "42P01" || error.code === "PGRST205") {
        return NextResponse.json({ history: [] });
      }
      throw error;
    }

    return NextResponse.json({ history: data || [] });
  } catch (error) {
    console.error("[PI] Sync history error:", error);
    return NextResponse.json(
      { error: "Failed to fetch sync history" },
      { status: 500 }
    );
  }
}
