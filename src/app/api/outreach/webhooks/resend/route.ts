import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

// POST /api/outreach/webhooks/resend - Handle Resend email events
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const { type, data } = payload;

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
      // Unknown event type, acknowledge but ignore
      return NextResponse.json({ received: true });
    }

    const supabase = getSupabase();

    // Find email by Resend ID
    const { data: email, error: fetchError } = await supabase
      .from("outreach_emails")
      .select("id, campaign_id, status, first_opened_at, first_clicked_at")
      .eq("resend_id", data.email_id)
      .single();

    if (fetchError || !email) {
      // Not an outreach email, ignore
      console.log("Webhook for non-outreach email:", data.email_id);
      return NextResponse.json({ received: true });
    }

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

        await supabase.rpc("increment_campaign_delivered", {
          p_campaign_id: email.campaign_id,
        });
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
            open_count: supabase.rpc ? undefined : 0, // Handle increment separately
          })
          .eq("id", email.id);

        // Increment open count - try RPC first, fallback to direct update
        const { error: rpcError } = await supabase.rpc("increment", {
          row_id: email.id,
          table_name: "outreach_emails",
          column_name: "open_count",
        });

        if (rpcError) {
          // If rpc doesn't exist, update directly
          await supabase
            .from("outreach_emails")
            .update({ open_count: ((email as { open_count?: number }).open_count || 0) + 1 })
            .eq("id", email.id);
        }

        // Only increment campaign opened on first open
        if (isFirstOpen) {
          await supabase.rpc("increment_campaign_opened", {
            p_campaign_id: email.campaign_id,
          });
        }
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
          })
          .eq("id", email.id);

        // Only increment campaign clicked on first click
        if (isFirstClick) {
          await supabase.rpc("increment_campaign_clicked", {
            p_campaign_id: email.campaign_id,
          });
        }
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

        await supabase.rpc("increment_campaign_bounced", {
          p_campaign_id: email.campaign_id,
        });
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

        await supabase.rpc("increment_campaign_bounced", {
          p_campaign_id: email.campaign_id,
        });
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
    console.error("Resend webhook error:", error);
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
