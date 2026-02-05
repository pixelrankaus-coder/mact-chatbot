import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

// GET /api/outreach/campaigns/[id]/replies - Get campaign replies
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    const supabase = getSupabase();

    const { data: replies, error } = await supabase
      .from("outreach_replies")
      .select("*")
      .eq("campaign_id", id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Failed to fetch replies:", error);
      return NextResponse.json(
        { error: "Failed to fetch replies", details: error.message },
        { status: 500 }
      );
    }

    // Get total count
    const { count } = await supabase
      .from("outreach_replies")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", id);

    return NextResponse.json({
      replies: replies || [],
      total: count || 0,
    });
  } catch (error) {
    console.error("Campaign replies error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
