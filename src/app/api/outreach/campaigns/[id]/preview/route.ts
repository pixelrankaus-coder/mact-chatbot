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

// GET /api/outreach/campaigns/[id]/preview - Preview campaign with sample recipients
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

    // Get recipients
    const recipients = await getSegmentRecipients(
      campaign.segment,
      campaign.segment_filter
    );

    // Build sample previews (first 5 recipients)
    const sampleRecipients = recipients.slice(0, 5).map((recipient) => {
      const personalization = buildPersonalizationData(recipient);
      const preview = renderTemplate(
        {
          subject: campaign.template.subject,
          body: campaign.template.body,
        },
        personalization
      );

      return {
        email: recipient.email,
        name: recipient.name,
        company: recipient.company,
        personalization,
        preview,
      };
    });

    return NextResponse.json({
      campaign,
      template: campaign.template,
      total_recipients: recipients.length,
      sample_recipients: sampleRecipients,
    });
  } catch (error) {
    console.error("Campaign preview error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
