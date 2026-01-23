import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

// POST /api/outreach/campaigns/[id]/pause - Pause a sending campaign
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabase();

    // Check campaign exists and is sending
    const { data: campaign, error: fetchError } = await supabase
      .from("outreach_campaigns")
      .select("status")
      .eq("id", id)
      .single();

    if (fetchError || !campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    if (campaign.status !== "sending") {
      return NextResponse.json(
        { error: "Campaign is not currently sending" },
        { status: 400 }
      );
    }

    // Update to paused
    const { error: updateError } = await supabase
      .from("outreach_campaigns")
      .update({
        status: "paused",
        paused_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to pause campaign", details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Campaign paused",
    });
  } catch (error) {
    console.error("Pause campaign error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
