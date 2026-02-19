import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { processCampaignBatch } from "@/lib/outreach/send";

export const dynamic = "force-dynamic";

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

// GET /api/cron/auto-resend - Process auto-resend for completed campaigns
export async function GET(request: NextRequest) {
  // Verify cron secret (same pattern as data-sync)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isDev = process.env.NODE_ENV === "development";

  if (!isDev && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn("[Auto-Resend] Unauthorized cron access attempt");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();
  const now = new Date();

  try {
    // ── Part 1: Create child campaigns for eligible parents ──

    // Find completed campaigns with auto_resend enabled that haven't been resent yet
    const { data: campaigns, error } = await supabase
      .from("outreach_campaigns")
      .select(
        "id, name, template_id, segment, segment_filter, from_name, from_email, reply_to, send_rate, send_delay_ms, resend_delay_hours, resend_subject, completed_at, is_dry_run"
      )
      .eq("status", "completed")
      .eq("auto_resend_enabled", true)
      .is("resend_campaign_id", null)
      .or("is_dry_run.is.null,is_dry_run.eq.false");

    if (error) {
      console.error("[Auto-Resend] Failed to fetch campaigns:", error);
      return NextResponse.json(
        { error: "Database error", details: error.message },
        { status: 500 }
      );
    }

    const results: Array<{
      campaign_id: string;
      status: string;
      child_campaign_id?: string;
      non_openers?: number;
      reason?: string;
      error?: string;
      resend_after?: string;
    }> = [];

    for (const campaign of campaigns || []) {
      // Check if delay has elapsed
      if (!campaign.completed_at || !campaign.resend_delay_hours) {
        continue;
      }

      const completedAt = new Date(campaign.completed_at);
      const resendAfter = new Date(
        completedAt.getTime() + campaign.resend_delay_hours * 60 * 60 * 1000
      );

      if (now < resendAfter) {
        results.push({
          campaign_id: campaign.id,
          status: "not_ready",
          resend_after: resendAfter.toISOString(),
        });
        continue;
      }

      // Find non-openers: status is sent or delivered (not opened/clicked/replied/bounced/failed)
      const { data: nonOpeners, error: emailError } = await supabase
        .from("outreach_emails")
        .select(
          "recipient_email, recipient_name, recipient_company, personalization, customer_id"
        )
        .eq("campaign_id", campaign.id)
        .in("status", ["sent", "delivered"]);

      if (emailError) {
        console.error(
          `[Auto-Resend] Failed to fetch non-openers for ${campaign.id}:`,
          emailError
        );
        results.push({
          campaign_id: campaign.id,
          status: "error",
          error: emailError.message,
        });
        continue;
      }

      if (!nonOpeners || nonOpeners.length === 0) {
        // Everyone opened (or bounced/failed) — mark as done with self-reference sentinel
        await supabase
          .from("outreach_campaigns")
          .update({ resend_campaign_id: campaign.id })
          .eq("id", campaign.id);

        console.log(
          `[Auto-Resend] ${campaign.name}: No non-openers, skipping`
        );
        results.push({
          campaign_id: campaign.id,
          status: "skipped",
          reason: "no_non_openers",
        });
        continue;
      }

      // Create child campaign
      const childName = `${campaign.name} (Follow-up)`;
      const { data: childCampaign, error: createError } = await supabase
        .from("outreach_campaigns")
        .insert({
          name: childName,
          template_id: campaign.template_id,
          segment: campaign.segment,
          segment_filter: campaign.segment_filter,
          from_name: campaign.from_name,
          from_email: campaign.from_email,
          reply_to: campaign.reply_to,
          send_rate: campaign.send_rate,
          send_delay_ms: campaign.send_delay_ms,
          status: "sending",
          started_at: now.toISOString(),
          total_recipients: nonOpeners.length,
          parent_campaign_id: campaign.id,
          resend_subject: campaign.resend_subject,
          is_dry_run: false,
          auto_resend_enabled: false,
        })
        .select("id")
        .single();

      if (createError || !childCampaign) {
        console.error(
          `[Auto-Resend] Failed to create child for ${campaign.id}:`,
          createError
        );
        results.push({
          campaign_id: campaign.id,
          status: "error",
          error: createError?.message,
        });
        continue;
      }

      // Queue emails in batches of 100
      const emailRecords = nonOpeners.map((email) => ({
        campaign_id: childCampaign.id,
        customer_id: email.customer_id || null,
        recipient_email: email.recipient_email,
        recipient_name: email.recipient_name,
        recipient_company: email.recipient_company,
        personalization: email.personalization,
        status: "pending",
      }));

      for (let i = 0; i < emailRecords.length; i += 100) {
        const batch = emailRecords.slice(i, i + 100);
        const { error: insertError } = await supabase
          .from("outreach_emails")
          .insert(batch);

        if (insertError) {
          console.error(
            `[Auto-Resend] Failed to insert email batch for ${childCampaign.id}:`,
            insertError
          );
        }
      }

      // Link parent to child (duplicate prevention)
      await supabase
        .from("outreach_campaigns")
        .update({ resend_campaign_id: childCampaign.id })
        .eq("id", campaign.id);

      console.log(
        `[Auto-Resend] Created follow-up "${childName}" with ${nonOpeners.length} recipients`
      );
      results.push({
        campaign_id: campaign.id,
        status: "created",
        child_campaign_id: childCampaign.id,
        non_openers: nonOpeners.length,
      });
    }

    // ── Part 2: Process sending child campaigns ──

    const { data: sendingChildren } = await supabase
      .from("outreach_campaigns")
      .select("id, name")
      .eq("status", "sending")
      .not("parent_campaign_id", "is", null);

    const batchResults: Array<{
      campaign_id: string;
      processed: number;
      remaining: number;
      completed: boolean;
    }> = [];

    if (sendingChildren && sendingChildren.length > 0) {
      for (const child of sendingChildren) {
        try {
          const result = await processCampaignBatch(child.id, 25);
          batchResults.push({
            campaign_id: child.id,
            processed: result.processed,
            remaining: result.remaining,
            completed: result.completed,
          });
          console.log(
            `[Auto-Resend] Processed batch for "${child.name}": ${result.processed} sent, ${result.remaining} remaining`
          );
        } catch (err) {
          console.error(
            `[Auto-Resend] Failed to process batch for ${child.id}:`,
            err
          );
        }
      }
    }

    return NextResponse.json({
      message: "Auto-resend processing complete",
      campaigns_checked: results.length,
      results,
      batches_processed: batchResults,
    });
  } catch (error) {
    console.error("[Auto-Resend] Cron error:", error);
    return NextResponse.json(
      {
        error: "Auto-resend failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Allow POST for manual testing
export async function POST(request: NextRequest) {
  return GET(request);
}
