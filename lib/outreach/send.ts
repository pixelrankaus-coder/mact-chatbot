import { Resend } from "resend";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
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

type LogLevel = "info" | "success" | "warning" | "error";

interface LogContext {
  campaignId?: string;
  emailId?: string;
  supabase?: SupabaseClient;
}

// Logger that writes to both console AND database for real-time UI display
async function logToDb(
  level: LogLevel,
  step: string,
  message: string,
  data: unknown,
  ctx: LogContext
) {
  // Always log to console
  const timestamp = new Date().toISOString();
  const levelSymbol = level === "error" ? "!!!" : level === "warning" ? "!!" : level === "success" ? "+++" : ">>>";
  console.log(`\n========================================`);
  console.log(`[OUTREACH ${timestamp}] [${level.toUpperCase()}]`);
  console.log(`${levelSymbol} ${step}: ${message}`);
  if (data !== undefined) {
    console.log(`DATA:`, JSON.stringify(data, null, 2));
  }
  console.log(`========================================\n`);

  // Write to database for UI display (fire and forget to not slow down sending)
  if (ctx.campaignId && ctx.supabase) {
    ctx.supabase
      .from("outreach_send_logs")
      .insert({
        campaign_id: ctx.campaignId,
        email_id: ctx.emailId || null,
        level,
        step,
        message,
        data: data ? JSON.parse(JSON.stringify(data)) : null,
      })
      .then(({ error }) => {
        if (error) {
          console.error("[LogToDb] Failed to write log:", error.message);
        }
      });
  }
}

// Simple console-only logger (backwards compat)
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
  const supabase = getSupabase();

  // Create log context (will be updated once we have campaign ID)
  const ctx: LogContext = { emailId, supabase };

  await logToDb("info", "start", "Starting to send email", { emailId }, ctx);

  // Get email with campaign and template
  await logToDb("info", "fetch_email", "Fetching email record from database...", null, ctx);
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
    await logToDb("error", "fetch_email", `Failed to fetch email: ${fetchError.message}`, {
      code: fetchError.code,
      details: fetchError.details
    }, ctx);
    return { success: false, error: `Database error: ${fetchError.message}` };
  }

  if (!email) {
    await logToDb("error", "fetch_email", "Email not found in database", { emailId }, ctx);
    return { success: false, error: "Email not found" };
  }

  // Update context with campaign ID for proper logging
  ctx.campaignId = email.campaign_id;

  await logToDb("info", "fetch_email", "Email record found", {
    emailId: email.id,
    recipientEmail: email.recipient_email,
    recipientName: email.recipient_name,
    status: email.status,
  }, ctx);

  if (!email.campaign) {
    await logToDb("error", "load_campaign", "Campaign not found for email", { campaignId: email.campaign_id }, ctx);
    return { success: false, error: "Campaign not found" };
  }

  if (!email.campaign.template) {
    await logToDb("error", "load_template", "Template not found for campaign", {
      templateId: email.campaign.template_id
    }, ctx);
    return { success: false, error: "Template not found" };
  }

  await logToDb("info", "load_template", "Campaign and template loaded", {
    campaignName: email.campaign.name,
    templateName: email.campaign.template.name,
    fromName: email.campaign.from_name,
    fromEmail: email.campaign.from_email,
    replyTo: email.campaign.reply_to,
  }, ctx);

  // Fetch signature: campaign-level → automation default → campaign default → legacy columns
  let signatureHtml = "";

  if (email.campaign.signature_id) {
    const { data: sig } = await supabase
      .from("outreach_signatures")
      .select("signature_html")
      .eq("id", email.campaign.signature_id)
      .single();
    signatureHtml = sig?.signature_html || "";
  } else {
    const useAutomationSig = !!(email.campaign.metadata as Record<string, unknown>)?.use_automation_signature;
    const { data: settings } = await supabase
      .from("outreach_settings")
      .select("default_signature_id, automation_signature_id, signature_html, automation_signature_html")
      .single();

    const targetSigId = useAutomationSig
      ? (settings?.automation_signature_id || settings?.default_signature_id)
      : settings?.default_signature_id;

    if (targetSigId) {
      const { data: sig } = await supabase
        .from("outreach_signatures")
        .select("signature_html")
        .eq("id", targetSigId)
        .single();
      signatureHtml = sig?.signature_html || "";
    }

    // Legacy fallback
    if (!signatureHtml) {
      signatureHtml = useAutomationSig
        ? (settings?.automation_signature_html || settings?.signature_html || "")
        : (settings?.signature_html || "");
    }
  }

  // Render template
  await logToDb("info", "render_template", "Rendering email template...", null, ctx);
  const { subject: renderedSubject, body } = renderTemplate(
    {
      subject: email.campaign.template.subject,
      body: email.campaign.template.body,
    },
    email.personalization || {}
  );

  // Override subject for auto-resend child campaigns
  let subject = renderedSubject;
  if (email.campaign.resend_subject) {
    const { subject: overrideSubject } = renderTemplate(
      { subject: email.campaign.resend_subject, body: "" },
      email.personalization || {}
    );
    subject = overrideSubject;
  }

  await logToDb("info", "render_template", "Template rendered successfully", {
    subject: subject,
    bodyPreview: body.substring(0, 150) + (body.length > 150 ? "..." : ""),
    personalization: email.personalization,
  }, ctx);

  // Convert body to HTML and append signature
  // Decode any HTML entities that might have been double-encoded (e.g., &lt; -> <)
  const decodeHtmlEntities = (text: string): string => {
    return text
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&');
  };

  // Append UTM parameters to all outbound links for campaign attribution
  const addUtmParams = (url: string, campaignName: string, isFollowUp: boolean): string => {
    try {
      const parsed = new URL(url);
      // Only add UTM to http/https links, skip mailto: tel: etc.
      if (!parsed.protocol.startsWith("http")) return url;
      // Don't overwrite existing UTM params
      if (parsed.searchParams.has("utm_source")) return url;
      parsed.searchParams.set("utm_source", "email");
      parsed.searchParams.set("utm_medium", "outreach");
      parsed.searchParams.set("utm_campaign", campaignName.toLowerCase().replace(/[^a-z0-9_-]/g, "-"));
      if (isFollowUp) {
        parsed.searchParams.set("utm_content", "followup");
      }
      return parsed.toString();
    } catch {
      return url; // Not a valid URL, return as-is
    }
  };

  const isFollowUp = !!email.campaign.parent_campaign_id;
  const utmCampaignName = email.campaign.name;

  // Add inline styles to links (email clients often strip <style> tags)
  const styleLinks = (html: string): string => {
    return html.replace(
      /<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi,
      (_match, href, text) => {
        const utmHref = addUtmParams(href, utmCampaignName, isFollowUp);
        return `<a href="${utmHref}" style="color: #2563eb; text-decoration: underline;">${text}</a>`;
      }
    );
  };

  const decodedBody = decodeHtmlEntities(body);
  const bodyHtml = decodedBody
    .split("\n")
    .map((line) => {
      const styledLine = styleLinks(line);
      return `<p style="margin: 0 0 10px 0;">${styledLine || "&nbsp;"}</p>`;
    })
    .join("");

  const htmlEmail = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    a { color: #2563eb; text-decoration: underline; }
  </style>
</head>
<body style="font-family: Arial, sans-serif; font-size: 14px; color: #333; line-height: 1.6; margin: 0; padding: 20px;">
  <div style="max-width: 600px;">
    ${bodyHtml}
    ${signatureHtml}
  </div>
</body>
</html>`;

  // Create plain text version (strip HTML tags for email clients that prefer plain text)
  const plainText = decodedBody.replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, (_m, href, text) => {
    const utmHref = addUtmParams(href, utmCampaignName, isFollowUp);
    return `${text} (${utmHref})`;
  });

  // Prepare Resend payload
  const resendPayload = {
    from: `${email.campaign.from_name} <${email.campaign.from_email}>`,
    replyTo: email.campaign.reply_to,
    to: email.recipient_email,
    subject: subject,
    html: htmlEmail,
    text: plainText, // Plain text fallback with links converted to "text (url)" format
    headers: {
      "X-Campaign-Id": email.campaign_id,
      "X-Email-Id": email.id,
    },
  };

  // Check if this is a dry run / simulation
  const isDryRun = email.campaign.is_dry_run === true;

  if (isDryRun) {
    await logToDb("info", "send_api", `[DRY RUN] Simulating send to ${email.recipient_email}...`, {
      to: resendPayload.to,
      from: resendPayload.from,
      subject: resendPayload.subject,
      mode: "simulation",
    }, ctx);

    // Simulate a small delay for realism
    await new Promise((resolve) => setTimeout(resolve, 100));

    await logToDb("success", "send_api", `[DRY RUN] Email simulated successfully to ${email.recipient_email}`, {
      mode: "simulation",
      note: "No actual email was sent",
    }, ctx);

    // Update email as "sent" (simulated)
    const { error: updateError } = await supabase
      .from("outreach_emails")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        resend_id: `dry-run-${Date.now()}`,
        rendered_subject: subject,
        rendered_body: body,
      })
      .eq("id", emailId);

    if (updateError) {
      await logToDb("warning", "update_status", "Failed to update email status to sent", { error: updateError.message }, ctx);
    }

    // Log event
    await supabase.from("outreach_events").insert({
      email_id: emailId,
      campaign_id: email.campaign_id,
      event_type: "sent",
    });

    // Increment counter using RPC, with fallback to direct update
    const { error: rpcError } = await supabase.rpc("increment_campaign_sent", {
      p_campaign_id: email.campaign_id,
    });

    if (rpcError) {
      await logToDb("info", "update_counter", "RPC not available, using direct update", { error: rpcError.message }, ctx);
      // Fallback: Get current count and increment directly
      const { data: currentCampaign } = await supabase
        .from("outreach_campaigns")
        .select("sent_count")
        .eq("id", email.campaign_id)
        .single();

      await supabase
        .from("outreach_campaigns")
        .update({ sent_count: (currentCampaign?.sent_count || 0) + 1 })
        .eq("id", email.campaign_id);
    }

    await logToDb("success", "complete", `[DRY RUN] Simulated delivery to ${email.recipient_email}`, {
      mode: "simulation",
    }, ctx);

    return { success: true, resendId: `dry-run-${Date.now()}` };
  }

  await logToDb("info", "send_api", `Calling Resend API to send to ${email.recipient_email}...`, {
    to: resendPayload.to,
    from: resendPayload.from,
    subject: resendPayload.subject,
  }, ctx);

  try {
    const resendResponse = await getResend().emails.send(resendPayload);

    await logToDb("info", "send_api", "Resend API responded", {
      hasData: !!resendResponse.data,
      hasError: !!resendResponse.error,
    }, ctx);

    if (resendResponse.error) {
      await logToDb("error", "send_api", `Resend API error: ${resendResponse.error.message}`, {
        errorName: resendResponse.error.name,
        errorMessage: resendResponse.error.message,
      }, ctx);

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
        await logToDb("warning", "update_status", "Failed to update email status to failed", { error: updateError.message }, ctx);
      } else {
        await logToDb("warning", "update_status", "Email marked as FAILED", { recipient: email.recipient_email }, ctx);
      }

      return { success: false, error: resendResponse.error.message };
    }

    // SUCCESS!
    const resendId = resendResponse.data?.id;
    await logToDb("success", "send_api", `Email sent successfully to ${email.recipient_email}`, {
      resendId: resendId,
    }, ctx);

    // Update email as sent
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
      await logToDb("warning", "update_status", "Failed to update email status to sent", { error: updateError.message }, ctx);
    }

    // Log event
    await supabase.from("outreach_events").insert({
      email_id: emailId,
      campaign_id: email.campaign_id,
      event_type: "sent",
    });

    // Increment counter using RPC, with fallback to direct update
    const { error: rpcError2 } = await supabase.rpc("increment_campaign_sent", {
      p_campaign_id: email.campaign_id,
    });

    if (rpcError2) {
      await logToDb("info", "update_counter", "RPC not available, using direct update", { error: rpcError2.message }, ctx);
      // Fallback: Get current count and increment directly
      const { data: currentCampaign } = await supabase
        .from("outreach_campaigns")
        .select("sent_count")
        .eq("id", email.campaign_id)
        .single();

      await supabase
        .from("outreach_campaigns")
        .update({ sent_count: (currentCampaign?.sent_count || 0) + 1 })
        .eq("id", email.campaign_id);
    }

    await logToDb("success", "complete", `Email delivered to ${email.recipient_email}`, {
      resendId,
    }, ctx);

    return { success: true, resendId };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    const errorStack = err instanceof Error ? err.stack : undefined;

    await logToDb("error", "exception", `Unexpected error: ${errorMessage}`, {
      errorStack,
    }, ctx);

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
  const supabase = getSupabase();
  const ctx: LogContext = { campaignId, supabase };

  await logToDb("info", "batch_start", `Starting batch processing (size: ${batchSize})`, { batchSize }, ctx);

  // Check campaign status
  const { data: campaign, error: campaignError } = await supabase
    .from("outreach_campaigns")
    .select("status, send_delay_ms, name, total_recipients, sent_count, is_dry_run")
    .eq("id", campaignId)
    .single();

  if (campaignError) {
    await logToDb("error", "batch_check", `Failed to fetch campaign: ${campaignError.message}`, null, ctx);
    return { processed: 0, remaining: 0, completed: false, failed: 0 };
  }

  if (!campaign) {
    await logToDb("error", "batch_check", "Campaign not found", null, ctx);
    return { processed: 0, remaining: 0, completed: false, failed: 0 };
  }

  await logToDb("info", "batch_check", `Campaign: ${campaign.name}`, {
    status: campaign.status,
    totalRecipients: campaign.total_recipients,
    sentCount: campaign.sent_count,
    isDryRun: campaign.is_dry_run,
    sendDelayMs: campaign.send_delay_ms,
  }, ctx);

  if (campaign.status !== "sending") {
    await logToDb("warning", "batch_check", `Campaign not in sending status (${campaign.status})`, null, ctx);
    return { processed: 0, remaining: 0, completed: campaign.status === "completed", failed: 0 };
  }

  await logToDb("info", "batch_proceed", "Campaign status is 'sending', proceeding to fetch pending emails...", null, ctx);

  // Get pending emails
  const { data: pendingEmails, error: pendingError } = await supabase
    .from("outreach_emails")
    .select("id, recipient_email, status")
    .eq("campaign_id", campaignId)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(batchSize);

  if (pendingError) {
    await logToDb("error", "batch_fetch", `Failed to fetch pending emails: ${pendingError.message}`, {
      code: pendingError.code,
      details: pendingError.details,
    }, ctx);
    return { processed: 0, remaining: 0, completed: false, failed: 0 };
  }

  await logToDb("info", "batch_fetch", `Found ${pendingEmails?.length || 0} pending emails`, {
    emailIds: pendingEmails?.map(e => e.id.substring(0, 8)),
    recipients: pendingEmails?.map(e => e.recipient_email),
  }, ctx);

  // Also check total email counts for status display
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

  await logToDb("info", "batch_status", "Current email counts", {
    total: totalCount,
    pending: pendingCount,
    sent: sentCount,
    failed: failedCount,
    batchSize: pendingEmails?.length || 0,
  }, ctx);

  if (!pendingEmails || pendingEmails.length === 0) {
    await logToDb("success", "batch_complete", "All emails processed - campaign complete!", {
      totalSent: sentCount,
      totalFailed: failedCount,
    }, ctx);

    // Mark campaign complete
    const { error: completeError } = await supabase
      .from("outreach_campaigns")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", campaignId);

    if (completeError) {
      await logToDb("warning", "batch_complete", "Failed to mark campaign complete", { error: completeError.message }, ctx);
    }

    return { processed: 0, remaining: 0, completed: true, failed: 0 };
  }

  // RATE LIMIT CHECK for live campaigns (not dry runs)
  // This ensures we respect send_delay_ms even with batch size 1
  const isDryRun = campaign.is_dry_run === true;
  if (!isDryRun && campaign.send_delay_ms > 0) {
    // Check when the last email was sent
    // Use .maybeSingle() to handle case where no emails have been sent yet (returns null instead of error)
    const { data: lastSentEmail, error: lastSentError } = await supabase
      .from("outreach_emails")
      .select("sent_at")
      .eq("campaign_id", campaignId)
      .eq("status", "sent")
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Log if there was an error (for debugging), but continue processing
    if (lastSentError) {
      await logToDb("warning", "rate_limit_check", `Error checking last sent email: ${lastSentError.message}`, null, ctx);
    }

    if (lastSentEmail?.sent_at) {
      const lastSentTime = new Date(lastSentEmail.sent_at).getTime();
      const now = Date.now();
      const timeSinceLastSend = now - lastSentTime;
      const timeToWait = campaign.send_delay_ms - timeSinceLastSend;

      if (timeToWait > 0) {
        await logToDb("info", "rate_limit", `Rate limit: ${Math.ceil(timeToWait / 1000)}s until next send allowed`, {
          lastSentAt: lastSentEmail.sent_at,
          timeSinceLastSend: Math.floor(timeSinceLastSend / 1000),
          delayRequired: campaign.send_delay_ms / 1000,
          waitingFor: Math.ceil(timeToWait / 1000),
        }, ctx);

        // Return early - client will poll again
        return { processed: 0, remaining: pendingCount || 0, completed: false, failed: 0 };
      }
    }
  }

  await logToDb("info", "batch_process", `Processing ${pendingEmails.length} emails in this batch`, {
    recipients: pendingEmails.map(e => e.recipient_email),
  }, ctx);

  let processed = 0;
  let failed = 0;

  // FAST PATH for dry runs - batch all operations
  if (isDryRun) {
    await logToDb("info", "dry_run_batch", `[DRY RUN] FAST batch processing ${pendingEmails.length} emails...`, null, ctx);

    const emailIds = pendingEmails.map(e => e.id);
    const now = new Date().toISOString();

    // 1. Batch update ALL emails to "sent" in ONE query
    const { error: updateError } = await supabase
      .from("outreach_emails")
      .update({
        status: "sent",
        sent_at: now,
        resend_id: `dry-run-batch-${Date.now()}`,
      })
      .in("id", emailIds);

    if (updateError) {
      await logToDb("error", "dry_run_batch", `Failed to batch update emails: ${updateError.message}`, null, ctx);
      return { processed: 0, remaining: pendingCount || 0, completed: false, failed: pendingEmails.length };
    }

    // 2. Insert ALL events in ONE batch
    const events = emailIds.map(emailId => ({
      email_id: emailId,
      campaign_id: campaignId,
      event_type: "sent",
    }));

    await supabase.from("outreach_events").insert(events);

    // 3. Update campaign counter ONCE with total count
    await supabase
      .from("outreach_campaigns")
      .update({
        sent_count: (campaign.sent_count || 0) + pendingEmails.length,
      })
      .eq("id", campaignId);

    processed = pendingEmails.length;
    await logToDb("success", "dry_run_batch", `[DRY RUN] Batch processed ${processed} emails instantly`, {
      emailIds,
      processed,
    }, ctx);
  } else {
    // Normal path - send each email individually
    for (let i = 0; i < pendingEmails.length; i++) {
      const emailRecord = pendingEmails[i];

      await logToDb("info", "batch_email", `[${i + 1}/${pendingEmails.length}] Sending to ${emailRecord.recipient_email}...`, null, ctx);

      // Re-check campaign status before each send
      const { data: currentCampaign } = await supabase
        .from("outreach_campaigns")
        .select("status")
        .eq("id", campaignId)
        .single();

      if (currentCampaign?.status !== "sending") {
        await logToDb("warning", "batch_interrupt", `Campaign status changed to: ${currentCampaign?.status}`, null, ctx);
        break;
      }

      const result = await sendSingleEmail(emailRecord.id);

      if (result.success) {
        processed++;
      } else {
        failed++;
      }

      // Delay before next (except last in batch)
      if (i < pendingEmails.length - 1 && campaign.send_delay_ms > 0) {
        await logToDb("info", "batch_delay", `Waiting ${campaign.send_delay_ms}ms before next email...`, null, ctx);
        await new Promise((resolve) => setTimeout(resolve, campaign.send_delay_ms));
      }
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
    await logToDb("success", "batch_complete", "All emails processed - marking campaign complete", null, ctx);
    await supabase
      .from("outreach_campaigns")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", campaignId);
  }

  await logToDb("info", "batch_summary", `Batch finished: ${processed} sent, ${failed} failed, ${remaining} remaining`, {
    processed,
    failed,
    remaining,
    completed,
  }, ctx);

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
