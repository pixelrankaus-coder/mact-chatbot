/**
 * WooCommerce Integration Settings API
 * TASK MACT #035
 *
 * GET: Fetch current WooCommerce settings
 * POST: Save WooCommerce settings
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import WooCommerceRestApi from "@woocommerce/woocommerce-rest-api";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any;

interface WooCommerceSettings {
  url: string;
  consumer_key: string;
  consumer_secret: string;
}

const INTEGRATION_TYPE = "woocommerce";

/**
 * GET /api/settings/integrations/woocommerce
 * Returns current WooCommerce settings (with secrets masked)
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
      // Return default empty config
      return NextResponse.json({
        url: "",
        consumer_key: "",
        consumer_secret: "",
        is_enabled: false,
        has_credentials: false,
      });
    }

    const settings = data.settings as WooCommerceSettings;

    // Return settings with secrets masked
    return NextResponse.json({
      url: settings.url || "",
      consumer_key: settings.consumer_key ? "••••••••" + settings.consumer_key.slice(-4) : "",
      consumer_secret: settings.consumer_secret ? "••••••••" + settings.consumer_secret.slice(-4) : "",
      is_enabled: data.is_enabled,
      has_credentials: !!(settings.url && settings.consumer_key && settings.consumer_secret),
      updated_at: data.updated_at,
    });
  } catch (error) {
    console.error("Failed to fetch WooCommerce settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings/integrations/woocommerce
 * Save or test WooCommerce settings
 */
export async function POST(request: NextRequest) {
  const supabase = createServiceClient() as SupabaseAny;

  try {
    const body = await request.json();
    const { action, url, consumer_key, consumer_secret, is_enabled } = body;

    // Handle test connection action
    if (action === "test") {
      return await testConnection(url, consumer_key, consumer_secret, supabase);
    }

    // Validate required fields for save
    if (!url) {
      return NextResponse.json(
        { error: "Store URL is required" },
        { status: 400 }
      );
    }

    // Get existing settings to preserve secrets if not provided
    const { data: existing } = await supabase
      .from("integration_settings")
      .select("settings")
      .eq("integration_type", INTEGRATION_TYPE)
      .single();

    const existingSettings = (existing?.settings || {}) as WooCommerceSettings;

    // Build new settings - only update secrets if new ones are provided
    const newSettings: WooCommerceSettings = {
      url: normalizeUrl(url),
      consumer_key: consumer_key && !consumer_key.includes("••••")
        ? consumer_key
        : existingSettings.consumer_key || "",
      consumer_secret: consumer_secret && !consumer_secret.includes("••••")
        ? consumer_secret
        : existingSettings.consumer_secret || "",
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
      message: "WooCommerce settings saved",
    });
  } catch (error) {
    console.error("Failed to save WooCommerce settings:", error);
    return NextResponse.json(
      { error: "Failed to save settings" },
      { status: 500 }
    );
  }
}

/**
 * Test WooCommerce connection with provided credentials
 */
async function testConnection(
  url: string,
  consumerKey: string,
  consumerSecret: string,
  supabase: SupabaseAny
) {
  // If masked credentials provided, fetch real ones from DB
  let realKey = consumerKey;
  let realSecret = consumerSecret;

  if (consumerKey?.includes("••••") || consumerSecret?.includes("••••")) {
    const { data } = await supabase
      .from("integration_settings")
      .select("settings")
      .eq("integration_type", INTEGRATION_TYPE)
      .single();

    if (data?.settings) {
      const settings = data.settings as WooCommerceSettings;
      if (consumerKey?.includes("••••")) realKey = settings.consumer_key;
      if (consumerSecret?.includes("••••")) realSecret = settings.consumer_secret;
    }
  }

  if (!url || !realKey || !realSecret) {
    return NextResponse.json(
      { success: false, error: "Missing credentials" },
      { status: 400 }
    );
  }

  try {
    // Create a test API client
    const testApi = new WooCommerceRestApi({
      url: normalizeUrl(url),
      consumerKey: realKey,
      consumerSecret: realSecret,
      version: "wc/v3",
    });

    // Try to fetch system status or store info
    const response = await testApi.get("system_status");

    if (response.data) {
      return NextResponse.json({
        success: true,
        message: "Connection successful!",
        store_info: {
          environment: response.data.environment?.site_url,
          wc_version: response.data.environment?.version,
        },
      });
    }

    return NextResponse.json({
      success: false,
      error: "Unexpected response from WooCommerce API",
    });
  } catch (error) {
    console.error("WooCommerce connection test failed:", error);

    // Parse error message
    let errorMessage = "Connection failed";
    if (error instanceof Error) {
      if (error.message.includes("401")) {
        errorMessage = "Invalid API credentials. Check your Consumer Key and Secret.";
      } else if (error.message.includes("404")) {
        errorMessage = "WooCommerce REST API not found. Check the store URL.";
      } else if (error.message.includes("ENOTFOUND") || error.message.includes("ECONNREFUSED")) {
        errorMessage = "Cannot reach store URL. Check the URL is correct.";
      } else {
        errorMessage = error.message;
      }
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 400 }
    );
  }
}

/**
 * Normalize store URL (ensure https, remove trailing slash)
 */
function normalizeUrl(url: string): string {
  let normalized = url.trim();

  // Add https if no protocol
  if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
    normalized = "https://" + normalized;
  }

  // Remove trailing slash
  normalized = normalized.replace(/\/+$/, "");

  return normalized;
}
