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
  console.log(`[Outreach] Sending email ${emailId}...`);
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
    console.log(`[Outreach] ❌ Email ${emailId} not found`);
    return { success: false, error: "Email not found" };
  }

  if (!email.campaign || !email.campaign.template) {
    console.log(`[Outreach] ❌ Campaign or template not found for email ${emailId}`);
    return { success: false, error: "Campaign or template not found" };
  }

  console.log(`[Outreach] Sending to: ${email.recipient_email} (${email.recipient_name})`);
  console.log(`[Outreach] Campaign: ${email.campaign.name}, Template: ${email.campaign.template.name}`);

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
      console.log(`[Outreach] ❌ Resend API error: ${error.message}`);
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

    console.log(`[Outreach] ✅ Email sent successfully! Resend ID: ${data?.id}`);

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
  console.log(`[Outreach] Processing batch for campaign ${campaignId}...`);
  const supabase = getSupabase();

  // Check campaign is still sending
  const { data: campaign } = await supabase
    .from("outreach_campaigns")
    .select("status, send_delay_ms, name")
    .eq("id", campaignId)
    .single();

  if (!campaign || campaign.status !== "sending") {
    console.log(`[Outreach] Campaign not in sending status (${campaign?.status}), skipping`);
    return { processed: 0, remaining: 0, completed: false };
  }

  console.log(`[Outreach] Campaign "${campaign.name}" is sending, delay: ${campaign.send_delay_ms}ms`);

  // Get pending emails
  const { data: pendingEmails } = await supabase
    .from("outreach_emails")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(batchSize);

  if (!pendingEmails || pendingEmails.length === 0) {
    console.log(`[Outreach] ✅ No pending emails - campaign complete!`);
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

  console.log(`[Outreach] Found ${pendingEmails.length} pending emails to send`);

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

  const remaining = count || 0;
  const completed = remaining === 0;

  console.log(`[Outreach] Batch complete: ${processed} sent, ${remaining} remaining${completed ? " - CAMPAIGN DONE!" : ""}`);

  return { processed, remaining, completed };
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
