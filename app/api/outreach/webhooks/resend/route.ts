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

// Helper: increment a campaign counter with RPC, fallback to direct update
async function incrementCampaignCounter(
  supabase: ReturnType<typeof getSupabase>,
  rpcName: string,
  campaignId: string,
  columnName: string
) {
  const { error: rpcError } = await supabase.rpc(rpcName, {
    p_campaign_id: campaignId,
  });

  if (rpcError) {
    console.warn(`[Webhook] RPC ${rpcName} failed, using direct update:`, rpcError.message);
    // Fallback: fetch current count and increment directly
    const { data: campaign } = await supabase
      .from("outreach_campaigns")
      .select(columnName)
      .eq("id", campaignId)
      .single();

    const currentCount = (campaign as Record<string, number> | null)?.[columnName] || 0;
    await supabase
      .from("outreach_campaigns")
      .update({ [columnName]: currentCount + 1 })
      .eq("id", campaignId);
  }
}

// POST /api/outreach/webhooks/resend - Handle Resend email events
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const { type, data } = payload;

    console.log("[Webhook] Received event:", type, "email_id:", data?.email_id);

    // Validate event type
    const validTypes = [
      "email.sent",
      "email.delivered",
      "email.opened",
      "email.clicked",
      "email.bounced",
      "email.complained",
    ];

    if (!validTypes.includes(type)) {
      console.log("[Webhook] Unknown event type, ignoring:", type);
      return NextResponse.json({ received: true });
    }

    const supabase = getSupabase();

    // Find email by Resend ID
    const { data: email, error: fetchError } = await supabase
      .from("outreach_emails")
      .select("id, campaign_id, status, first_opened_at, first_clicked_at, open_count, click_count")
      .eq("resend_id", data.email_id)
      .single();

    if (fetchError || !email) {
      console.log("[Webhook] No matching outreach email for resend_id:", data.email_id);
      return NextResponse.json({ received: true });
    }

    console.log("[Webhook] Matched email:", email.id, "campaign:", email.campaign_id, "current status:", email.status);

    const now = new Date().toISOString();

    switch (type) {
      case "email.delivered": {
        await supabase
          .from("outreach_emails")
          .update({
            status: "delivered",
            delivered_at: now,
          })
          .eq("id", email.id);

        await incrementCampaignCounter(supabase, "increment_campaign_delivered", email.campaign_id, "delivered_count");
        console.log("[Webhook] Delivered:", email.id);
        break;
      }

      case "email.opened": {
        const isFirstOpen = !email.first_opened_at;

        // Don't downgrade status if already clicked or replied
        const newStatus = ["clicked", "replied"].includes(email.status)
          ? email.status
          : "opened";

        await supabase
          .from("outreach_emails")
          .update({
            status: newStatus,
            first_opened_at: isFirstOpen ? now : email.first_opened_at,
            last_opened_at: now,
            open_count: (email.open_count || 0) + 1,
          })
          .eq("id", email.id);

        // Only increment campaign opened on first open
        if (isFirstOpen) {
          await incrementCampaignCounter(supabase, "increment_campaign_opened", email.campaign_id, "opened_count");
        }
        console.log("[Webhook] Opened:", email.id, "first:", isFirstOpen);
        break;
      }

      case "email.clicked": {
        const isFirstClick = !email.first_clicked_at;

        // Don't downgrade if already replied
        const newStatus = email.status === "replied" ? "replied" : "clicked";

        await supabase
          .from("outreach_emails")
          .update({
            status: newStatus,
            first_clicked_at: isFirstClick ? now : email.first_clicked_at,
            click_count: (email.click_count || 0) + 1,
          })
          .eq("id", email.id);

        // Only increment campaign clicked on first click
        if (isFirstClick) {
          await incrementCampaignCounter(supabase, "increment_campaign_clicked", email.campaign_id, "clicked_count");
        }
        console.log("[Webhook] Clicked:", email.id, "first:", isFirstClick, "link:", data.click?.link);
        break;
      }

      case "email.bounced": {
        await supabase
          .from("outreach_emails")
          .update({
            status: "bounced",
            bounced_at: now,
            error_message: data.bounce?.message || "Bounced",
          })
          .eq("id", email.id);

        await incrementCampaignCounter(supabase, "increment_campaign_bounced", email.campaign_id, "bounced_count");
        console.log("[Webhook] Bounced:", email.id, "reason:", data.bounce?.message);
        break;
      }

      case "email.complained": {
        await supabase
          .from("outreach_emails")
          .update({
            status: "bounced",
            bounced_at: now,
            error_message: "Marked as spam",
          })
          .eq("id", email.id);

        await incrementCampaignCounter(supabase, "increment_campaign_bounced", email.campaign_id, "bounced_count");
        console.log("[Webhook] Complained (spam):", email.id);
        break;
      }
    }

    // Log event
    await supabase.from("outreach_events").insert({
      email_id: email.id,
      campaign_id: email.campaign_id,
      event_type: type.replace("email.", ""),
      metadata: data,
      resend_event_id: data.event_id,
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Webhook] Error processing:", error);
    // Return 200 to prevent Resend from retrying
    return NextResponse.json({ received: true, error: "Processing failed" });
  }
}

// GET for webhook verification (optional)
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Resend webhook endpoint active",
  });
}
