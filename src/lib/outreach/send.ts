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

// Human-readable logger
function log(message: string, data?: unknown) {
  const timestamp = new Date().toISOString();
  console.log(`\n========================================`);
  console.log(`[OUTREACH ${timestamp}]`);
  console.log(`>>> ${message}`);
  if (data !== undefined) {
    console.log(`DATA:`, JSON.stringify(data, null, 2));
  }
  console.log(`========================================\n`);
}

export interface SendResult {
  success: boolean;
  resendId?: string;
  error?: string;
}

export async function sendSingleEmail(emailId: string): Promise<SendResult> {
  log(`STEP 1: Starting to send email`, { emailId });

  const supabase = getSupabase();

  // Get email with campaign and template
  log(`STEP 2: Fetching email record from database...`);
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

  if (fetchError) {
    log(`ERROR: Failed to fetch email from database`, {
      error: fetchError.message,
      code: fetchError.code,
      details: fetchError.details
    });
    return { success: false, error: `Database error: ${fetchError.message}` };
  }

  if (!email) {
    log(`ERROR: Email not found in database`, { emailId });
    return { success: false, error: "Email not found" };
  }

  log(`STEP 3: Email record found`, {
    emailId: email.id,
    recipientEmail: email.recipient_email,
    recipientName: email.recipient_name,
    status: email.status,
    campaignId: email.campaign_id,
  });

  if (!email.campaign) {
    log(`ERROR: Campaign not found for email`, { emailId, campaignId: email.campaign_id });
    return { success: false, error: "Campaign not found" };
  }

  if (!email.campaign.template) {
    log(`ERROR: Template not found for campaign`, {
      emailId,
      campaignId: email.campaign_id,
      templateId: email.campaign.template_id
    });
    return { success: false, error: "Template not found" };
  }

  log(`STEP 4: Campaign and template loaded`, {
    campaignName: email.campaign.name,
    templateName: email.campaign.template.name,
    fromName: email.campaign.from_name,
    fromEmail: email.campaign.from_email,
    replyTo: email.campaign.reply_to,
  });

  // Render template
  log(`STEP 5: Rendering email template...`);
  const { subject, body } = renderTemplate(
    {
      subject: email.campaign.template.subject,
      body: email.campaign.template.body,
    },
    email.personalization || {}
  );

  log(`STEP 6: Template rendered`, {
    subject: subject,
    bodyPreview: body.substring(0, 200) + (body.length > 200 ? "..." : ""),
    personalization: email.personalization,
  });

  // Prepare Resend payload
  const resendPayload = {
    from: `${email.campaign.from_name} <${email.campaign.from_email}>`,
    replyTo: email.campaign.reply_to,
    to: email.recipient_email,
    subject: subject,
    text: body,
    headers: {
      "X-Campaign-Id": email.campaign_id,
      "X-Email-Id": email.id,
    },
  };

  log(`STEP 7: Calling Resend API...`, {
    to: resendPayload.to,
    from: resendPayload.from,
    subject: resendPayload.subject,
    replyTo: resendPayload.replyTo,
  });

  try {
    const resendResponse = await getResend().emails.send(resendPayload);

    log(`STEP 8: Resend API responded`, {
      data: resendResponse.data,
      error: resendResponse.error,
    });

    if (resendResponse.error) {
      log(`ERROR: Resend API returned error`, {
        errorName: resendResponse.error.name,
        errorMessage: resendResponse.error.message,
      });

      // Update email status to failed
      const { error: updateError } = await supabase
        .from("outreach_emails")
        .update({
          status: "failed",
          failed_at: new Date().toISOString(),
          error_message: resendResponse.error.message,
        })
        .eq("id", emailId);

      if (updateError) {
        log(`ERROR: Failed to update email status to failed`, { updateError });
      } else {
        log(`STEP 9: Email status updated to FAILED in database`);
      }

      return { success: false, error: resendResponse.error.message };
    }

    // SUCCESS!
    const resendId = resendResponse.data?.id;
    log(`SUCCESS: Email sent via Resend!`, {
      resendId: resendId,
      recipient: email.recipient_email,
    });

    // Update email as sent
    log(`STEP 9: Updating email status to SENT in database...`);
    const { error: updateError } = await supabase
      .from("outreach_emails")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        resend_id: resendId,
        rendered_subject: subject,
        rendered_body: body,
      })
      .eq("id", emailId);

    if (updateError) {
      log(`WARNING: Failed to update email status to sent`, { updateError });
    }

    // Log event
    log(`STEP 10: Logging sent event...`);
    await supabase.from("outreach_events").insert({
      email_id: emailId,
      campaign_id: email.campaign_id,
      event_type: "sent",
    });

    // Increment counter using RPC
    log(`STEP 11: Incrementing campaign sent counter...`);
    const { error: rpcError } = await supabase.rpc("increment_campaign_sent", {
      p_campaign_id: email.campaign_id,
    });

    if (rpcError) {
      log(`WARNING: Failed to increment sent counter`, { rpcError });
    }

    log(`COMPLETE: Email successfully sent!`, {
      emailId,
      resendId,
      recipient: email.recipient_email,
    });

    return { success: true, resendId };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    const errorStack = err instanceof Error ? err.stack : undefined;

    log(`EXCEPTION: Unexpected error during send`, {
      errorMessage,
      errorStack,
      errorType: typeof err,
    });

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
  failed: number;
}

export async function processCampaignBatch(
  campaignId: string,
  batchSize: number = 10
): Promise<BatchResult> {
  log(`BATCH START: Processing campaign batch`, { campaignId, batchSize });

  const supabase = getSupabase();

  // Check campaign status
  log(`BATCH STEP 1: Checking campaign status...`);
  const { data: campaign, error: campaignError } = await supabase
    .from("outreach_campaigns")
    .select("status, send_delay_ms, name, total_recipients, sent_count")
    .eq("id", campaignId)
    .single();

  if (campaignError) {
    log(`BATCH ERROR: Failed to fetch campaign`, { error: campaignError });
    return { processed: 0, remaining: 0, completed: false, failed: 0 };
  }

  if (!campaign) {
    log(`BATCH ERROR: Campaign not found`, { campaignId });
    return { processed: 0, remaining: 0, completed: false, failed: 0 };
  }

  log(`BATCH STEP 2: Campaign status check`, {
    campaignName: campaign.name,
    status: campaign.status,
    totalRecipients: campaign.total_recipients,
    sentCount: campaign.sent_count,
    sendDelayMs: campaign.send_delay_ms,
  });

  if (campaign.status !== "sending") {
    log(`BATCH SKIP: Campaign not in sending status`, {
      currentStatus: campaign.status,
      expectedStatus: "sending"
    });
    return { processed: 0, remaining: 0, completed: campaign.status === "completed", failed: 0 };
  }

  // Get pending emails
  log(`BATCH STEP 3: Fetching pending emails...`);
  const { data: pendingEmails, error: pendingError } = await supabase
    .from("outreach_emails")
    .select("id, recipient_email, status")
    .eq("campaign_id", campaignId)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(batchSize);

  if (pendingError) {
    log(`BATCH ERROR: Failed to fetch pending emails`, { error: pendingError });
    return { processed: 0, remaining: 0, completed: false, failed: 0 };
  }

  // Also check total email counts for debugging
  const { count: totalCount } = await supabase
    .from("outreach_emails")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaignId);

  const { count: pendingCount } = await supabase
    .from("outreach_emails")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("status", "pending");

  const { count: sentCount } = await supabase
    .from("outreach_emails")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("status", "sent");

  const { count: failedCount } = await supabase
    .from("outreach_emails")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("status", "failed");

  log(`BATCH STEP 4: Email counts for campaign`, {
    totalEmails: totalCount,
    pendingEmails: pendingCount,
    sentEmails: sentCount,
    failedEmails: failedCount,
    fetchedForBatch: pendingEmails?.length || 0,
  });

  if (!pendingEmails || pendingEmails.length === 0) {
    log(`BATCH COMPLETE: No pending emails remaining`);

    // Mark campaign complete
    const { error: completeError } = await supabase
      .from("outreach_campaigns")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", campaignId);

    if (completeError) {
      log(`BATCH WARNING: Failed to mark campaign complete`, { error: completeError });
    } else {
      log(`BATCH: Campaign marked as COMPLETED`);
    }

    return { processed: 0, remaining: 0, completed: true, failed: 0 };
  }

  log(`BATCH STEP 5: Processing ${pendingEmails.length} emails...`, {
    emails: pendingEmails.map(e => ({ id: e.id, recipient: e.recipient_email })),
  });

  // Send each email
  let processed = 0;
  let failed = 0;

  for (let i = 0; i < pendingEmails.length; i++) {
    const emailRecord = pendingEmails[i];

    log(`BATCH EMAIL ${i + 1}/${pendingEmails.length}: Starting send`, {
      emailId: emailRecord.id,
      recipient: emailRecord.recipient_email,
    });

    // Re-check campaign status before each send
    const { data: currentCampaign } = await supabase
      .from("outreach_campaigns")
      .select("status")
      .eq("id", campaignId)
      .single();

    if (currentCampaign?.status !== "sending") {
      log(`BATCH INTERRUPTED: Campaign status changed`, {
        newStatus: currentCampaign?.status
      });
      break;
    }

    const result = await sendSingleEmail(emailRecord.id);

    if (result.success) {
      processed++;
      log(`BATCH EMAIL ${i + 1}/${pendingEmails.length}: SUCCESS`, {
        resendId: result.resendId,
      });
    } else {
      failed++;
      log(`BATCH EMAIL ${i + 1}/${pendingEmails.length}: FAILED`, {
        error: result.error,
      });
    }

    // Delay before next (except last in batch)
    if (i < pendingEmails.length - 1 && campaign.send_delay_ms > 0) {
      log(`BATCH: Waiting ${campaign.send_delay_ms}ms before next email...`);
      await new Promise((resolve) => setTimeout(resolve, campaign.send_delay_ms));
    }
  }

  // Count remaining
  const { count: remainingCount } = await supabase
    .from("outreach_emails")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("status", "pending");

  const remaining = remainingCount || 0;
  const completed = remaining === 0;

  if (completed) {
    log(`BATCH: All emails processed, marking campaign complete...`);
    await supabase
      .from("outreach_campaigns")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", campaignId);
  }

  log(`BATCH COMPLETE`, {
    processedSuccessfully: processed,
    failedToSend: failed,
    remainingPending: remaining,
    campaignCompleted: completed,
  });

  return { processed, remaining, completed, failed };
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
