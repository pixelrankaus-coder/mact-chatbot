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
    const body = await request.json();
    const {
      name,
      template_id,
      segment,
      segment_filter,
      from_name = "Chris Born",
      from_email = "c.born@mact.au",
      reply_to = "c.born@mact.au",
      send_rate = 50,
      scheduled_at,
      start_immediately = false,
    } = body;

    if (!name || !template_id || !segment) {
      return NextResponse.json(
        { error: "Missing required fields: name, template_id, segment" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

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
