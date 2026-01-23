import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { renderTemplate } from "./templates";

// Lazy-load Resend client to avoid build-time errors
let resendClient: Resend | null = null;
function getResend(): Resend {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

export interface SendResult {
  success: boolean;
  resendId?: string;
  error?: string;
}

export async function sendSingleEmail(emailId: string): Promise<SendResult> {
  const supabase = getSupabase();

  // Get email with campaign and template
  const { data: email, error: fetchError } = await supabase
    .from("outreach_emails")
    .select(
      `
      *,
      campaign:outreach_campaigns(
        *,
        template:outreach_templates(*)
      )
    `
    )
    .eq("id", emailId)
    .single();

  if (fetchError || !email) {
    return { success: false, error: "Email not found" };
  }

  if (!email.campaign || !email.campaign.template) {
    return { success: false, error: "Campaign or template not found" };
  }

  // Render template
  const { subject, body } = renderTemplate(
    {
      subject: email.campaign.template.subject,
      body: email.campaign.template.body,
    },
    email.personalization || {}
  );

  try {
    // Send via Resend - PLAIN TEXT ONLY for personal feel
    const { data, error } = await getResend().emails.send({
      from: `${email.campaign.from_name} <${email.campaign.from_email}>`,
      replyTo: email.campaign.reply_to,
      to: email.recipient_email,
      subject: subject,
      text: body, // Plain text only for personal feel
      headers: {
        "X-Campaign-Id": email.campaign_id,
        "X-Email-Id": email.id,
      },
    });

    if (error) {
      await supabase
        .from("outreach_emails")
        .update({
          status: "failed",
          failed_at: new Date().toISOString(),
          error_message: error.message,
        })
        .eq("id", emailId);

      return { success: false, error: error.message };
    }

    // Update email as sent
    await supabase
      .from("outreach_emails")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        resend_id: data?.id,
        rendered_subject: subject,
        rendered_body: body,
      })
      .eq("id", emailId);

    // Log event
    await supabase.from("outreach_events").insert({
      email_id: emailId,
      campaign_id: email.campaign_id,
      event_type: "sent",
    });

    // Increment counter using RPC
    await supabase.rpc("increment_campaign_sent", {
      p_campaign_id: email.campaign_id,
    });

    return { success: true, resendId: data?.id };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";

    await supabase
      .from("outreach_emails")
      .update({
        status: "failed",
        failed_at: new Date().toISOString(),
        error_message: errorMessage,
      })
      .eq("id", emailId);

    return { success: false, error: errorMessage };
  }
}

export interface BatchResult {
  processed: number;
  remaining: number;
  completed: boolean;
}

export async function processCampaignBatch(
  campaignId: string,
  batchSize: number = 10
): Promise<BatchResult> {
  const supabase = getSupabase();

  // Check campaign is still sending
  const { data: campaign } = await supabase
    .from("outreach_campaigns")
    .select("status, send_delay_ms")
    .eq("id", campaignId)
    .single();

  if (!campaign || campaign.status !== "sending") {
    return { processed: 0, remaining: 0, completed: false };
  }

  // Get pending emails
  const { data: pendingEmails } = await supabase
    .from("outreach_emails")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(batchSize);

  if (!pendingEmails || pendingEmails.length === 0) {
    // Mark campaign complete
    await supabase
      .from("outreach_campaigns")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", campaignId);

    return { processed: 0, remaining: 0, completed: true };
  }

  // Send each email with delay
  let processed = 0;
  for (let i = 0; i < pendingEmails.length; i++) {
    // Re-check status before each send
    const { data: currentCampaign } = await supabase
      .from("outreach_campaigns")
      .select("status")
      .eq("id", campaignId)
      .single();

    if (currentCampaign?.status !== "sending") {
      break; // Paused or cancelled
    }

    const result = await sendSingleEmail(pendingEmails[i].id);
    if (result.success) {
      processed++;
    }

    // Delay before next (except last in batch)
    if (i < pendingEmails.length - 1) {
      await new Promise((resolve) =>
        setTimeout(resolve, campaign.send_delay_ms)
      );
    }
  }

  // Count remaining
  const { count } = await supabase
    .from("outreach_emails")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("status", "pending");

  return { processed, remaining: count || 0, completed: (count || 0) === 0 };
}

export async function startCampaignProcessing(
  campaignId: string
): Promise<void> {
  let completed = false;

  while (!completed) {
    const result = await processCampaignBatch(campaignId, 10);
    completed = result.completed || result.remaining === 0;

    // Small delay between batches
    if (!completed) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}
