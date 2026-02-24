import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getSegmentRecipients,
  buildPersonalizationData,
} from "@/lib/outreach/segments";
import { renderTemplate } from "@/lib/outreach/templates";

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

// Decode any HTML entities that might have been double-encoded
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

// Add inline styles to links (email clients often strip <style> tags)
function styleLinks(html: string): string {
  return html.replace(
    /<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi,
    '<a href="$1" style="color: #2563eb; text-decoration: underline;">$2</a>'
  );
}

// Build full HTML email exactly as it will be sent
function buildHtmlEmail(body: string, signatureHtml: string): string {
  const decodedBody = decodeHtmlEntities(body);
  const bodyHtml = decodedBody
    .split("\n")
    .map((line) => {
      const styledLine = styleLinks(line);
      return `<p style="margin: 0 0 10px 0;">${styledLine || "&nbsp;"}</p>`;
    })
    .join("");

  return `<!DOCTYPE html>
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
}

// GET /api/outreach/campaigns/[id]/preview - Preview campaign with ALL recipients
// Also queues emails if not already queued (to avoid re-fetching during send)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabase();

    // Get campaign with template
    const { data: campaign, error: campaignError } = await supabase
      .from("outreach_campaigns")
      .select(
        `
        *,
        template:outreach_templates(*)
      `
      )
      .eq("id", id)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    if (!campaign.template) {
      return NextResponse.json(
        { error: "Campaign template not found" },
        { status: 404 }
      );
    }

    // Fetch signature: campaign-level → automation default → campaign default → legacy
    let signatureHtml = "";

    if (campaign.signature_id) {
      const { data: sig } = await supabase
        .from("outreach_signatures")
        .select("signature_html")
        .eq("id", campaign.signature_id)
        .single();
      signatureHtml = sig?.signature_html || "";
    } else {
      const useAutomationSig = !!(campaign.metadata as Record<string, unknown>)?.use_automation_signature;
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

      if (!signatureHtml) {
        signatureHtml = useAutomationSig
          ? (settings?.automation_signature_html || settings?.signature_html || "")
          : (settings?.signature_html || "");
      }
    }

    // Check if emails are already queued
    const { count: existingCount } = await supabase
      .from("outreach_emails")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", id);

    let recipients;

    if (existingCount && existingCount > 0) {
      // Emails already queued - read from database (fast!)
      console.log(`[Preview] Using ${existingCount} already queued emails for campaign ${id}`);
      const { data: queuedEmails } = await supabase
        .from("outreach_emails")
        .select("recipient_email, recipient_name, recipient_company, personalization")
        .eq("campaign_id", id);

      recipients = (queuedEmails || []).map((e) => ({
        id: e.recipient_email,
        email: e.recipient_email,
        name: e.recipient_name || "",
        company: e.recipient_company,
        ...((e.personalization as Record<string, unknown>) || {}),
      }));
    } else {
      // Get ALL recipients (expensive - includes Cin7 API calls)
      console.log(`[Preview] Fetching segment recipients for campaign ${id} (first time)`);
      recipients = await getSegmentRecipients(
        campaign.segment,
        campaign.segment_filter
      );

      // Queue emails now so /send doesn't have to re-fetch
      if (recipients.length > 0) {
        console.log(`[Preview] Queuing ${recipients.length} emails for campaign ${id}`);
        const isCustomSegment = campaign.segment === "custom";
        const emailRecords = recipients.map((recipient) => ({
          campaign_id: id,
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
            console.error("[Preview] Failed to queue email batch:", insertError);
          }
        }
        console.log(`[Preview] Successfully queued ${recipients.length} emails`);
      }
    }

    // Build previews for ALL recipients with full HTML
    const allRecipients = recipients.map((recipient) => {
      const personalization = buildPersonalizationData(recipient as Parameters<typeof buildPersonalizationData>[0]);
      const preview = renderTemplate(
        {
          subject: campaign.template.subject,
          body: campaign.template.body,
        },
        personalization
      );

      // Build full HTML email exactly as it will be sent
      const htmlPreview = buildHtmlEmail(preview.body, signatureHtml);

      return {
        email: recipient.email,
        name: recipient.name,
        company: recipient.company,
        personalization,
        preview,
        html_preview: htmlPreview,
      };
    });

    return NextResponse.json({
      campaign,
      template: campaign.template,
      total_recipients: recipients.length,
      all_recipients: allRecipients,
      signature_html: signatureHtml,
    });
  } catch (error) {
    console.error("Campaign preview error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
