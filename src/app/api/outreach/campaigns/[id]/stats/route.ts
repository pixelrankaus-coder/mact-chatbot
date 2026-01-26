import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

    // Also count emails directly from outreach_emails table for accuracy
    // (counters might be out of sync if RPC fails)
    const { count: sentCount } = await supabase
      .from("outreach_emails")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", id)
      .eq("status", "sent");

    const { count: pendingCount } = await supabase
      .from("outreach_emails")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", id)
      .eq("status", "pending");

    // Use the higher of counter vs actual count (in case counters are behind)
    const actualSent = Math.max(campaign.sent_count || 0, sentCount || 0);
    const actualTotal = campaign.total_recipients || ((sentCount || 0) + (pendingCount || 0));

    // Calculate rates
    const stats = {
      total_recipients: actualTotal,
      sent: actualSent,
      delivered: campaign.delivered_count,
      delivery_rate:
        campaign.sent_count > 0
          ? ((campaign.delivered_count / campaign.sent_count) * 100).toFixed(1)
          : "0",
      opened: campaign.opened_count,
      open_rate:
        campaign.delivered_count > 0
          ? ((campaign.opened_count / campaign.delivered_count) * 100).toFixed(1)
          : "0",
      clicked: campaign.clicked_count,
      click_rate:
        campaign.delivered_count > 0
          ? ((campaign.clicked_count / campaign.delivered_count) * 100).toFixed(1)
          : "0",
      replied: campaign.replied_count,
      reply_rate:
        campaign.delivered_count > 0
          ? ((campaign.replied_count / campaign.delivered_count) * 100).toFixed(1)
          : "0",
      bounced: campaign.bounced_count,
      bounce_rate:
        campaign.sent_count > 0
          ? ((campaign.bounced_count / campaign.sent_count) * 100).toFixed(1)
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
