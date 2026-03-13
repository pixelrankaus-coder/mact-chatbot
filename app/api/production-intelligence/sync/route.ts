import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { runSync, SYNC_TYPES } from "@/lib/pi/sync";

/**
 * GET /api/production-intelligence/sync
 * Returns sync status for all sync types (latest run per type)
 */
export async function GET() {
  try {
    const supabase = createServiceClient();

    // Get latest sync run for each type
    const results = await Promise.all(
      SYNC_TYPES.map(async (syncType) => {
        const { data } = await supabase
          .from("pi_sync_log")
          .select("*")
          .eq("sync_type", syncType)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        return { sync_type: syncType, latest: data };
      })
    );

    return NextResponse.json({ syncs: results });
  } catch (error) {
    console.error("[PI] Sync status error:", error);
    return NextResponse.json(
      { error: "Failed to fetch sync status" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/production-intelligence/sync
 * Trigger a sync job. Body: { type: "skus" | "sales_history" | ... }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type } = body;

    if (!type || !SYNC_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `Invalid sync type. Must be one of: ${SYNC_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    // Run sync (this can take a while — runs inline for now)
    const result = await runSync(type);

    return NextResponse.json({
      type,
      records: result.records,
      error: result.error || null,
      status: result.error ? "failed" : "complete",
    });
  } catch (error) {
    console.error("[PI] Sync trigger error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}
