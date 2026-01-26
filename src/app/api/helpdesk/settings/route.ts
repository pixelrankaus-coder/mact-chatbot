import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

// GET /api/helpdesk/settings - Get helpdesk settings
export async function GET() {
  try {
    const supabase = getSupabase();

    const { data: settings, error } = await supabase
      .from("helpdesk_settings")
      .select("*")
      .single();

    if (error) {
      console.error("Failed to fetch helpdesk settings:", error);
      // Return default settings if table doesn't exist yet
      return NextResponse.json({
        enabled: false,
        auto_create_tickets: true,
        default_priority: "normal",
        snooze_options: [1, 4, 24, 48],
        working_hours: {
          enabled: false,
          timezone: "Pacific/Auckland",
          schedule: {},
        },
        notifications: {
          email_on_new_ticket: true,
          email_on_reply: true,
          notification_email: null,
        },
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Helpdesk settings error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/helpdesk/settings - Update helpdesk settings
export async function PATCH(request: Request) {
  try {
    const supabase = getSupabase();
    const updates = await request.json();

    const { data, error } = await supabase
      .from("helpdesk_settings")
      .update(updates)
      .eq("id", "00000000-0000-0000-0000-000000000001")
      .select()
      .single();

    if (error) {
      console.error("Failed to update helpdesk settings:", error);
      return NextResponse.json(
        { error: "Failed to update settings" },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Helpdesk settings update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
