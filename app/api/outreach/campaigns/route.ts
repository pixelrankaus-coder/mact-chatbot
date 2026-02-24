import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSegmentCount } from "@/lib/outreach/segments";

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

// GET /api/outreach/campaigns - List all campaigns
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();

    const { data: campaigns, error } = await supabase
      .from("outreach_campaigns")
      .select(
        `
        *,
        template:outreach_templates(id, name, subject)
      `
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch campaigns:", error);
      return NextResponse.json(
        { error: "Failed to fetch campaigns", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ campaigns: campaigns || [] });
  } catch (error) {
    console.error("Campaigns GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/outreach/campaigns - Create new campaign
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await request.json();

    // Fetch default settings from outreach_settings
    const { data: settings } = await supabase
      .from("outreach_settings")
      .select("default_from_name, default_from_email, default_reply_to, max_emails_per_hour")
      .single();

    const {
      name,
      template_id,
      segment,
      segment_filter,
      from_name = settings?.default_from_name || "Chris Born",
      from_email = settings?.default_from_email || "c.born@mact.au",
      reply_to = settings?.default_reply_to || "c.born@reply.mact.au",
      send_rate = settings?.max_emails_per_hour || 50,
      scheduled_at,
      start_immediately = false,
      is_dry_run = false,
      auto_resend_enabled = false,
      resend_delay_hours,
      resend_subject,
      signature_id,
    } = body;

    if (!name || !template_id || !segment) {
      return NextResponse.json(
        { error: "Missing required fields: name, template_id, segment" },
        { status: 400 }
      );
    }

    // Verify template exists
    const { data: template, error: templateError } = await supabase
      .from("outreach_templates")
      .select("id")
      .eq("id", template_id)
      .single();

    if (templateError || !template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    // Get recipient count
    const totalRecipients = await getSegmentCount(segment, segment_filter);

    if (totalRecipients === 0) {
      return NextResponse.json(
        { error: "No recipients in selected segment" },
        { status: 400 }
      );
    }

    // Calculate send delay (ms per email to achieve rate per hour)
    // rate = 50/hour means 1 email per 72 seconds = 72000ms
    const send_delay_ms = Math.round((60 * 60 * 1000) / send_rate);

    // Determine initial status
    let status = "draft";
    if (start_immediately) {
      status = "scheduled";
    } else if (scheduled_at) {
      status = "scheduled";
    }

    const { data: campaign, error } = await supabase
      .from("outreach_campaigns")
      .insert({
        name,
        template_id,
        segment,
        segment_filter: segment_filter || null,
        from_name,
        from_email,
        reply_to,
        send_rate,
        send_delay_ms,
        status,
        scheduled_at: scheduled_at || null,
        total_recipients: totalRecipients,
        is_dry_run: is_dry_run,
        auto_resend_enabled,
        resend_delay_hours: resend_delay_hours || null,
        resend_subject: resend_subject || null,
        signature_id: signature_id || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to create campaign:", error);
      return NextResponse.json(
        { error: "Failed to create campaign", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      campaign,
      total_recipients: totalRecipients,
    });
  } catch (error) {
    console.error("Campaign create error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
