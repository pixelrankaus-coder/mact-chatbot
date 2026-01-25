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

// Build full HTML email exactly as it will be sent
function buildHtmlEmail(body: string, signatureHtml: string): string {
  const decodedBody = decodeHtmlEntities(body);
  const bodyHtml = decodedBody
    .split("\n")
    .map((line) => `<p style="margin: 0 0 10px 0;">${line || "&nbsp;"}</p>`)
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

    // Get signature from outreach_settings
    const { data: settings } = await supabase
      .from("outreach_settings")
      .select("signature_html")
      .single();

    const signatureHtml = settings?.signature_html || "";

    // Get ALL recipients (not just first 5)
    const recipients = await getSegmentRecipients(
      campaign.segment,
      campaign.segment_filter
    );

    // Build previews for ALL recipients with full HTML
    const allRecipients = recipients.map((recipient) => {
      const personalization = buildPersonalizationData(recipient);
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
