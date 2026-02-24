import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

// Default settings values
const DEFAULT_SETTINGS = {
  default_from_name: "Chris Born",
  default_from_email: "c.born@mact.au",
  default_reply_to: "c.born@reply.mact.au",
  forward_replies: true,
  forward_replies_to: "c.born@mact.au",
  max_emails_per_hour: 50,
  max_emails_per_day: 500,
  send_window_start: "09:00",
  send_window_end: "17:00",
  timezone: "Australia/Melbourne",
  track_opens: true,
  track_clicks: true,
  signature_json: null,
  signature_html: "",
  automation_signature_json: null,
  automation_signature_html: "",
  default_signature_id: null,
  automation_signature_id: null,
};

// GET /api/outreach/settings - Fetch outreach settings (create if not exists)
export async function GET() {
  try {
    const supabase = getSupabase();

    // Try to get existing settings
    const { data, error } = await supabase
      .from("outreach_settings")
      .select("*")
      .limit(1)
      .single();

    if (error && error.code === "PGRST116") {
      // No rows found - create default settings
      const { data: newSettings, error: insertError } = await supabase
        .from("outreach_settings")
        .insert(DEFAULT_SETTINGS)
        .select()
        .single();

      if (insertError) {
        console.error("Error creating default settings:", insertError);
        return NextResponse.json(
          { error: insertError.message },
          { status: 500 }
        );
      }

      return NextResponse.json(newSettings);
    }

    if (error) {
      console.error("Error fetching settings:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Auto-migrate: if default_signature_id is not set, migrate existing signatures to outreach_signatures table
    if (data && !data.default_signature_id && (data.signature_html || data.signature_json)) {
      try {
        const { data: sig1 } = await supabase
          .from("outreach_signatures")
          .insert({
            name: "Default (Chris)",
            signature_html: data.signature_html || "",
            signature_json: data.signature_json || null,
          })
          .select("id")
          .single();

        let sig2Id = null;
        if (data.automation_signature_html || data.automation_signature_json) {
          const { data: sig2 } = await supabase
            .from("outreach_signatures")
            .insert({
              name: "Automation (Lauren)",
              signature_html: data.automation_signature_html || "",
              signature_json: data.automation_signature_json || null,
            })
            .select("id")
            .single();
          sig2Id = sig2?.id || null;
        }

        if (sig1?.id) {
          const updateObj: Record<string, unknown> = { default_signature_id: sig1.id };
          if (sig2Id) updateObj.automation_signature_id = sig2Id;
          await supabase.from("outreach_settings").update(updateObj).eq("id", data.id);
          data.default_signature_id = sig1.id;
          data.automation_signature_id = sig2Id;
        }
        console.log("[Settings] Auto-migrated signatures to outreach_signatures table");
      } catch (migErr) {
        console.error("[Settings] Signature migration failed (non-fatal):", migErr);
      }
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/outreach/settings - Update or create settings (upsert)
export async function PUT(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await request.json();

    // Get current settings ID (if exists)
    const { data: current } = await supabase
      .from("outreach_settings")
      .select("id")
      .limit(1)
      .single();

    if (current?.id) {
      // Update existing settings
      const { data, error } = await supabase
        .from("outreach_settings")
        .update({
          ...body,
          updated_at: new Date().toISOString(),
        })
        .eq("id", current.id)
        .select()
        .single();

      if (error) {
        console.error("Error updating settings:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data);
    } else {
      // Create new settings
      const { data, error } = await supabase
        .from("outreach_settings")
        .insert({
          ...DEFAULT_SETTINGS,
          ...body,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating settings:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data);
    }
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/outreach/settings - Partial update (for backwards compatibility)
export async function PATCH(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await request.json();

    // Get current settings ID
    const { data: current } = await supabase
      .from("outreach_settings")
      .select("id")
      .limit(1)
      .single();

    if (!current) {
      return NextResponse.json({ error: "Settings not found" }, { status: 404 });
    }

    // Update settings
    const { data, error } = await supabase
      .from("outreach_settings")
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq("id", current.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating settings:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
