import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

// GET /api/outreach/campaigns/[id] - Get single campaign
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabase();

    const { data: campaign, error } = await supabase
      .from("outreach_campaigns")
      .select(
        `
        *,
        template:outreach_templates(*)
      `
      )
      .eq("id", id)
      .single();

    if (error || !campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ campaign });
  } catch (error) {
    console.error("Campaign GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/outreach/campaigns/[id] - Update campaign
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const supabase = getSupabase();

    // Check campaign exists and is editable
    const { data: existing, error: fetchError } = await supabase
      .from("outreach_campaigns")
      .select("status")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Check what kind of edit is allowed based on current status
    const isStatusChangeOnly = Object.keys(body).length === 1 && body.status !== undefined;

    // Allow cancelling from paused or sending status
    if (isStatusChangeOnly && body.status === "cancelled") {
      if (!["draft", "scheduled", "paused", "sending"].includes(existing.status)) {
        return NextResponse.json(
          { error: "Cannot cancel campaign in current status" },
          { status: 400 }
        );
      }
    } else {
      // Full edits only allowed for draft/scheduled campaigns
      if (!["draft", "scheduled"].includes(existing.status)) {
        return NextResponse.json(
          { error: "Cannot edit campaign in current status" },
          { status: 400 }
        );
      }
    }

    const allowedFields = [
      "name",
      "template_id",
      "segment",
      "segment_filter",
      "from_name",
      "from_email",
      "reply_to",
      "send_rate",
      "scheduled_at",
      "status",
      "is_dry_run",
      "auto_resend_enabled",
      "resend_delay_hours",
      "resend_subject",
    ];

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    // Recalculate send_delay_ms if send_rate changed
    if (body.send_rate) {
      updates.send_delay_ms = Math.round((60 * 60 * 1000) / body.send_rate);
    }

    const { data: campaign, error } = await supabase
      .from("outreach_campaigns")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Failed to update campaign:", error);
      return NextResponse.json(
        { error: "Failed to update campaign", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ campaign });
  } catch (error) {
    console.error("Campaign PUT error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/outreach/campaigns/[id] - Delete campaign
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabase();

    // Check campaign exists
    const { data: existing, error: fetchError } = await supabase
      .from("outreach_campaigns")
      .select("status")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Cannot delete sending campaigns
    if (existing.status === "sending") {
      return NextResponse.json(
        { error: "Cannot delete a campaign that is currently sending" },
        { status: 400 }
      );
    }

    // Delete associated emails first (cascade should handle this, but explicit is safer)
    await supabase.from("outreach_emails").delete().eq("campaign_id", id);

    // Delete campaign
    const { error } = await supabase
      .from("outreach_campaigns")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Failed to delete campaign:", error);
      return NextResponse.json(
        { error: "Failed to delete campaign", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Campaign DELETE error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
