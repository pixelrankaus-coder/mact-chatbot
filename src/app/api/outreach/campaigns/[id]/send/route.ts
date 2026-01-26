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

    // Check if emails already queued (from preview step - this is the fast path!)
    const { count: existingCount } = await supabase
      .from("outreach_emails")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", campaignId);

    let totalRecipients = existingCount || 0;

    // Only fetch segment recipients if NOT already queued (fallback for edge cases)
    // This skips the expensive Cin7 API calls when emails were queued during preview
    if (!existingCount || existingCount === 0) {
      console.log(`[Send] No emails queued yet for campaign ${campaignId}, fetching segment recipients...`);

      // Get recipients based on segment (expensive - includes Cin7 API calls!)
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

      totalRecipients = recipients.length;

      // Queue all emails
      const isCustomSegment = campaign.segment === "custom";
      const emailRecords = recipients.map((recipient) => ({
        campaign_id: campaignId,
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
          console.error("[Send] Failed to insert email batch:", insertError);
        }
      }
    } else {
      // Emails already queued from preview - FAST path, no Cin7 API calls!
      console.log(`[Send] Using ${existingCount} already queued emails for campaign ${campaignId}`);
    }

    if (totalRecipients === 0) {
      return NextResponse.json(
        { error: "No recipients in segment" },
        { status: 400 }
      );
    }

    // Update campaign to sending
    await supabase
      .from("outreach_campaigns")
      .update({
        status: "sending",
        started_at: campaign.started_at || new Date().toISOString(),
        total_recipients: totalRecipients,
        updated_at: new Date().toISOString(),
      })
      .eq("id", campaignId);

    // For DRY RUNS only: process first batch here (it's instant)
    // For LIVE campaigns: skip batch processing - let client polling handle it
    // This avoids Vercel timeout (live emails have 36+ second delays between sends)
    if (campaign.is_dry_run) {
      const batchResult = await processCampaignBatch(campaignId, 100);
      return NextResponse.json({
        success: true,
        campaign_id: campaignId,
        total_recipients: totalRecipients,
        processed: batchResult.processed,
        remaining: batchResult.remaining,
        completed: batchResult.completed,
        message: batchResult.completed
          ? "Campaign completed"
          : "Campaign started - processing continues",
      });
    }

    // Live campaign - just return success, client will poll /process endpoint
    return NextResponse.json({
      success: true,
      campaign_id: campaignId,
      total_recipients: totalRecipients,
      processed: 0,
      remaining: totalRecipients,
      completed: false,
      message: "Campaign started - client polling will process emails",
    });
  } catch (error) {
    console.error("Send campaign error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
