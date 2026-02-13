/**
 * Email Alert Preferences API
 *
 * GET: Fetch email alert preferences for all team members
 * POST: Save email alert preferences
 */

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any;

interface AlertPreferences {
  service_alerts: boolean;
  new_conversations: boolean;
  handoff_requests: boolean;
}

type EmailAlertPreferences = Record<string, AlertPreferences>;

export async function GET() {
  const supabase = createServiceClient() as SupabaseAny;

  try {
    const { data, error } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "email_alert_preferences")
      .single();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    return NextResponse.json({
      preferences: (data?.value as EmailAlertPreferences) || {},
    });
  } catch (error) {
    console.error("Failed to fetch email alert preferences:", error);
    return NextResponse.json({ preferences: {} });
  }
}

export async function POST(request: Request) {
  const supabase = createServiceClient() as SupabaseAny;

  try {
    const { preferences } = (await request.json()) as {
      preferences: EmailAlertPreferences;
    };

    const { error } = await supabase.from("settings").upsert(
      {
        key: "email_alert_preferences",
        value: preferences,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to save email alert preferences:", error);
    return NextResponse.json(
      { error: "Failed to save preferences" },
      { status: 500 }
    );
  }
}
