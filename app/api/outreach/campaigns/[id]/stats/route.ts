import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

// GET /api/outreach/campaigns/[id]/stats - Get campaign stats
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabase();

    const { data: campaign, error } = await supabase
      .from("outreach_campaigns")
      .select(
        `
        *,
        template:outreach_templates(id, name, subject)
      `
      )
      .eq("id", id)
      .single();

    if (error || !campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Count emails directly from outreach_emails table for accuracy
    // (counters might be out of sync if RPC fails)
    // Note: email statuses progress (sent → delivered → opened → clicked),
    // so "delivered" count includes emails that are now opened/clicked/replied
    const { count: pendingCount } = await supabase
      .from("outreach_emails")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", id)
      .eq("status", "pending");

    const { count: actualClickedCount } = await supabase
      .from("outreach_emails")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", id)
      .eq("status", "clicked");

    const { count: actualBouncedCount } = await supabase
      .from("outreach_emails")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", id)
      .eq("status", "bounced");

    // Count all non-pending, non-failed emails as "sent"
    const { count: totalProcessed } = await supabase
      .from("outreach_emails")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", id)
      .not("status", "in", '("pending","failed")');

    // Use the higher of counter vs actual count (in case counters are behind)
    const actualSent = Math.max(campaign.sent_count || 0, totalProcessed || 0);
    const actualTotal = campaign.total_recipients || ((totalProcessed || 0) + (pendingCount || 0));

    // Use max of campaign counter vs direct count for each metric
    const clicked = Math.max(campaign.clicked_count || 0, actualClickedCount || 0);
    const bounced = Math.max(campaign.bounced_count || 0, actualBouncedCount || 0);
    const delivered = Math.max(campaign.delivered_count || 0, 0);
    const opened = Math.max(campaign.opened_count || 0, 0);
    const replied = Math.max(campaign.replied_count || 0, 0);

    // Calculate rates
    const stats = {
      total_recipients: actualTotal,
      sent: actualSent,
      delivered,
      delivery_rate:
        actualSent > 0
          ? ((delivered / actualSent) * 100).toFixed(1)
          : "0",
      opened,
      open_rate:
        delivered > 0
          ? ((opened / delivered) * 100).toFixed(1)
          : "0",
      clicked,
      click_rate:
        delivered > 0
          ? ((clicked / delivered) * 100).toFixed(1)
          : "0",
      replied,
      reply_rate:
        delivered > 0
          ? ((replied / delivered) * 100).toFixed(1)
          : "0",
      bounced,
      bounce_rate:
        actualSent > 0
          ? ((bounced / actualSent) * 100).toFixed(1)
          : "0",
    };

    return NextResponse.json({ campaign, stats });
  } catch (error) {
    console.error("Campaign stats error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
