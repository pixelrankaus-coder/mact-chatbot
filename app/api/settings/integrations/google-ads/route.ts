/**
 * Google Ads Integration Settings API
 *
 * GET: Fetch current Google Ads OAuth settings
 * POST: Save Google Ads OAuth settings
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any;

interface GoogleAdsSettings {
  client_id: string;
  client_secret: string;
  developer_token: string;
  redirect_uri?: string;
}

const INTEGRATION_TYPE = "google_ads";

/**
 * GET /api/settings/integrations/google-ads
 * Returns current Google Ads settings (with secrets masked)
 */
export async function GET() {
  const supabase = createServiceClient() as SupabaseAny;

  try {
    const { data, error } = await supabase
      .from("integration_settings")
      .select("settings, is_enabled, updated_at")
      .eq("integration_type", INTEGRATION_TYPE)
      .single();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    if (!data) {
      return NextResponse.json({
        client_id: "",
        client_secret: "",
        developer_token: "",
        is_enabled: false,
        has_credentials: false,
      });
    }

    const settings = data.settings as GoogleAdsSettings;

    return NextResponse.json({
      client_id: settings.client_id ? "••••••••" + settings.client_id.slice(-8) : "",
      client_secret: settings.client_secret ? "••••••••" + settings.client_secret.slice(-4) : "",
      developer_token: settings.developer_token ? "••••••••" + settings.developer_token.slice(-4) : "",
      is_enabled: data.is_enabled,
      has_credentials: !!(settings.client_id && settings.client_secret && settings.developer_token),
      updated_at: data.updated_at,
    });
  } catch (error) {
    console.error("Failed to fetch Google Ads settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings/integrations/google-ads
 * Save Google Ads OAuth settings
 */
export async function POST(request: NextRequest) {
  const supabase = createServiceClient() as SupabaseAny;

  try {
    const body = await request.json();
    const { client_id, client_secret, developer_token, is_enabled } = body;

    // Get existing settings to preserve secrets if not provided
    const { data: existing } = await supabase
      .from("integration_settings")
      .select("settings")
      .eq("integration_type", INTEGRATION_TYPE)
      .single();

    const existingSettings = (existing?.settings || {}) as GoogleAdsSettings;

    // Build new settings - only update secrets if new ones are provided
    const newSettings: GoogleAdsSettings = {
      client_id: client_id && !client_id.includes("••••")
        ? client_id
        : existingSettings.client_id || "",
      client_secret: client_secret && !client_secret.includes("••••")
        ? client_secret
        : existingSettings.client_secret || "",
      developer_token: developer_token && !developer_token.includes("••••")
        ? developer_token
        : existingSettings.developer_token || "",
    };

    // Upsert settings
    const { error } = await supabase
      .from("integration_settings")
      .upsert({
        integration_type: INTEGRATION_TYPE,
        settings: newSettings,
        is_enabled: is_enabled ?? false,
        updated_at: new Date().toISOString(),
      }, { onConflict: "integration_type" });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: "Google Ads settings saved",
    });
  } catch (error) {
    console.error("Failed to save Google Ads settings:", error);
    return NextResponse.json(
      { error: "Failed to save settings" },
      { status: 500 }
    );
  }
}
