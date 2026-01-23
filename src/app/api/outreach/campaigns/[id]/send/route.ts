import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getSegmentRecipients,
  buildPersonalizationData,
} from "@/lib/outreach/segments";
import { processCampaignBatch } from "@/lib/outreach/send";

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

// POST /api/outreach/campaigns/[id]/send - Start sending campaign
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params;
    const supabase = getSupabase();

    // Get campaign with template
    const { data: campaign, error: campaignError } = await supabase
      .from("outreach_campaigns")
      .select("*, template:outreach_templates(*)")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    if (!["draft", "scheduled", "paused"].includes(campaign.status)) {
      return NextResponse.json(
        { error: "Campaign cannot be started from current status" },
        { status: 400 }
      );
    }

    // Get recipients based on segment
    const recipients = await getSegmentRecipients(
      campaign.segment,
      campaign.segment_filter
    );

    if (recipients.length === 0) {
      return NextResponse.json(
        { error: "No recipients in segment" },
        { status: 400 }
      );
    }

    // Check if emails already queued (for resume)
    const { count: existingCount } = await supabase
      .from("outreach_emails")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", campaignId);

    // Queue all emails if not already queued
    if (!existingCount || existingCount === 0) {
      const isCustomSegment = campaign.segment === "custom";
      const emailRecords = recipients.map((recipient) => ({
        campaign_id: campaignId,
        // For custom/test segments, customer_id is null (not a real customer)
        customer_id: isCustomSegment ? null : recipient.id,
        recipient_email: recipient.email,
        recipient_name: recipient.name,
        recipient_company: recipient.company,
        personalization: buildPersonalizationData(recipient),
        status: "pending",
      }));

      // Insert in batches of 100
      for (let i = 0; i < emailRecords.length; i += 100) {
        const batch = emailRecords.slice(i, i + 100);
        const { error: insertError } = await supabase
          .from("outreach_emails")
          .insert(batch);

        if (insertError) {
          console.error("Failed to insert email batch:", insertError);
        }
      }
    }

    // Update campaign to sending
    await supabase
      .from("outreach_campaigns")
      .update({
        status: "sending",
        started_at: campaign.started_at || new Date().toISOString(),
        total_recipients: recipients.length,
        updated_at: new Date().toISOString(),
      })
      .eq("id", campaignId);

    // Process first batch synchronously (Vercel kills background processes)
    // Client will call /process endpoint to continue for larger campaigns
    const batchResult = await processCampaignBatch(campaignId, 10);

    return NextResponse.json({
      success: true,
      campaign_id: campaignId,
      total_recipients: recipients.length,
      processed: batchResult.processed,
      remaining: batchResult.remaining,
      completed: batchResult.completed,
      message: batchResult.completed
        ? "Campaign completed"
        : "Campaign started - processing continues",
    });
  } catch (error) {
    console.error("Send campaign error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
