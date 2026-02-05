import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { processCampaignBatch } from "@/lib/outreach/send";

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

// POST /api/outreach/campaigns/[id]/process - Process next batch of emails
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params;
    const supabase = getSupabase();

    // Check campaign status
    const { data: campaign, error: campaignError } = await supabase
      .from("outreach_campaigns")
      .select("status, is_dry_run")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Only process if campaign is in "sending" status
    if (campaign.status !== "sending") {
      return NextResponse.json({
        success: true,
        message: `Campaign is ${campaign.status}, not sending`,
        processed: 0,
        remaining: 0,
        completed: campaign.status === "completed",
      });
    }

    // Batch size depends on campaign type:
    // - Dry runs: 100 (instant, no delays)
    // - Live: 1 (each email has long delay, avoid timeout)
    const batchSize = campaign.is_dry_run ? 100 : 1;
    const batchResult = await processCampaignBatch(campaignId, batchSize);

    return NextResponse.json({
      success: true,
      campaign_id: campaignId,
      processed: batchResult.processed,
      remaining: batchResult.remaining,
      completed: batchResult.completed,
    });
  } catch (error) {
    console.error("Process campaign error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
