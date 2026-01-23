import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { startCampaignProcessing } from "@/lib/outreach/send";

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

// POST /api/outreach/campaigns/[id]/resume - Resume a paused campaign
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabase();

    // Check campaign exists and is paused
    const { data: campaign, error: fetchError } = await supabase
      .from("outreach_campaigns")
      .select("status, total_recipients")
      .eq("id", id)
      .single();

    if (fetchError || !campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    if (campaign.status !== "paused") {
      return NextResponse.json(
        { error: "Campaign is not paused" },
        { status: 400 }
      );
    }

    // Get count of remaining emails
    const { count: remaining } = await supabase
      .from("outreach_emails")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", id)
      .eq("status", "pending");

    if (!remaining || remaining === 0) {
      // Mark as completed if no pending emails
      await supabase
        .from("outreach_campaigns")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      return NextResponse.json({
        success: true,
        message: "Campaign already completed - no pending emails",
        remaining: 0,
      });
    }

    // Update to sending
    const { error: updateError } = await supabase
      .from("outreach_campaigns")
      .update({
        status: "sending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to resume campaign", details: updateError.message },
        { status: 500 }
      );
    }

    // Resume processing in background
    startCampaignProcessing(id).catch((err) => {
      console.error("Campaign resume processing error:", err);
    });

    return NextResponse.json({
      success: true,
      message: "Campaign resumed",
      remaining,
    });
  } catch (error) {
    console.error("Resume campaign error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
