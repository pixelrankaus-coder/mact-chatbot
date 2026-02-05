import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

/**
 * GET /api/outreach/campaigns/[id]/logs
 * Fetch real-time send logs for a campaign
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params;
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const since = searchParams.get("since"); // ISO timestamp to fetch only newer logs

    const supabase = createServiceClient();

    // Build query
    let query = supabase
      .from("outreach_send_logs")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false })
      .limit(limit);

    // If "since" is provided, only fetch logs newer than that timestamp
    if (since) {
      query = query.gt("created_at", since);
    }

    const { data: logs, error } = await query;

    if (error) {
      console.error("Error fetching send logs:", error);
      return NextResponse.json(
        { error: "Failed to fetch logs" },
        { status: 500 }
      );
    }

    // Return logs in chronological order (oldest first for display)
    const orderedLogs = (logs || []).reverse();

    return NextResponse.json({
      logs: orderedLogs,
      count: orderedLogs.length,
    });
  } catch (error) {
    console.error("Send logs API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/outreach/campaigns/[id]/logs
 * Clear send logs for a campaign
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params;
    const supabase = createServiceClient();

    const { error } = await supabase
      .from("outreach_send_logs")
      .delete()
      .eq("campaign_id", campaignId);

    if (error) {
      console.error("Error clearing send logs:", error);
      return NextResponse.json(
        { error: "Failed to clear logs" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Clear logs API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
