/**
 * Cin7 Integration Settings API
 * TASK MACT #036, #039
 *
 * GET: Fetch current Cin7 settings
 * POST: Save Cin7 settings or test connection
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any;

interface Cin7Settings {
  account_id: string;
  api_key: string;
  sync_frequency?: string; // '15min' | '1hour' | '6hours' | 'daily' | 'manual'
  last_sync_at?: string;
  orders_cached?: number;
  customers_cached?: number;
}

const INTEGRATION_TYPE = "cin7";
const CIN7_BASE_URL = "https://inventory.dearsystems.com/ExternalApi/v2";

/**
 * GET /api/settings/integrations/cin7
 * Returns current Cin7 settings (with secrets masked)
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
        account_id: "",
        api_key: "",
        is_enabled: false,
        has_credentials: false,
      });
    }

    const settings = data.settings as Cin7Settings;

    // Return settings with secrets masked
    return NextResponse.json({
      account_id: settings.account_id ? "••••••••" + settings.account_id.slice(-4) : "",
      api_key: settings.api_key ? "••••••••" + settings.api_key.slice(-4) : "",
      is_enabled: data.is_enabled,
      has_credentials: !!(settings.account_id && settings.api_key),
      updated_at: data.updated_at,
      // Sync settings (TASK #039)
      sync_frequency: settings.sync_frequency || "1hour",
      last_sync_at: settings.last_sync_at || null,
      orders_cached: settings.orders_cached || 0,
      customers_cached: settings.customers_cached || 0,
    });
  } catch (error) {
    console.error("Failed to fetch Cin7 settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings/integrations/cin7
 * Save or test Cin7 settings
 */
export async function POST(request: NextRequest) {
  const supabase = createServiceClient() as SupabaseAny;

  try {
    const body = await request.json();
    const { action, account_id, api_key, is_enabled, sync_frequency } = body;

    // Handle test connection action
    if (action === "test") {
      return await testConnection(account_id, api_key, supabase);
    }

    // Validate required fields for save
    if (!account_id && !api_key) {
      // Allow saving with empty credentials (to disable)
    }

    // Get existing settings to preserve secrets if not provided
    const { data: existing } = await supabase
      .from("integration_settings")
      .select("settings")
      .eq("integration_type", INTEGRATION_TYPE)
      .single();

    const existingSettings = (existing?.settings || {}) as Cin7Settings;

    // Build new settings - only update secrets if new ones are provided
    // Preserve sync stats (last_sync_at, orders_cached, customers_cached)
    const newSettings: Cin7Settings = {
      account_id: account_id && !account_id.includes("••••")
        ? account_id
        : existingSettings.account_id || "",
      api_key: api_key && !api_key.includes("••••")
        ? api_key
        : existingSettings.api_key || "",
      // Sync settings (TASK #039)
      sync_frequency: sync_frequency || existingSettings.sync_frequency || "1hour",
      // Preserve existing sync stats
      last_sync_at: existingSettings.last_sync_at,
      orders_cached: existingSettings.orders_cached,
      customers_cached: existingSettings.customers_cached,
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
      message: "Cin7 settings saved",
    });
  } catch (error) {
    console.error("Failed to save Cin7 settings:", error);
    return NextResponse.json(
      { error: "Failed to save settings" },
      { status: 500 }
    );
  }
}

/**
 * Test Cin7 connection with provided credentials
 */
async function testConnection(
  accountId: string,
  apiKey: string,
  supabase: SupabaseAny
) {
  // If masked credentials provided, fetch real ones from DB
  let realAccountId = accountId;
  let realApiKey = apiKey;

  if (accountId?.includes("••••") || apiKey?.includes("••••")) {
    const { data } = await supabase
      .from("integration_settings")
      .select("settings")
      .eq("integration_type", INTEGRATION_TYPE)
      .single();

    if (data?.settings) {
      const settings = data.settings as Cin7Settings;
      if (accountId?.includes("••••")) realAccountId = settings.account_id;
      if (apiKey?.includes("••••")) realApiKey = settings.api_key;
    }
  }

  if (!realAccountId || !realApiKey) {
    return NextResponse.json(
      { success: false, error: "Missing credentials" },
      { status: 400 }
    );
  }

  try {
    // Try to fetch a simple endpoint to test credentials
    const res = await fetch(`${CIN7_BASE_URL}/me`, {
      headers: {
        "Content-Type": "application/json",
        "api-auth-accountid": realAccountId,
        "api-auth-applicationkey": realApiKey,
      },
    });

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json({
        success: true,
        message: "Connection successful!",
        account_info: {
          company: data.Company || data.Name,
          currency: data.BaseCurrency,
        },
      });
    }

    // Parse error response
    const errorText = await res.text();
    let errorMessage = "Connection failed";

    if (res.status === 401) {
      errorMessage = "Invalid API credentials. Check your Account ID and API Key.";
    } else if (res.status === 403) {
      errorMessage = "Access denied. API key may lack permissions.";
    } else if (res.status === 404) {
      errorMessage = "Cin7 API endpoint not found.";
    } else {
      errorMessage = `API error (${res.status}): ${errorText.slice(0, 100)}`;
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 400 }
    );
  } catch (error) {
    console.error("Cin7 connection test failed:", error);

    let errorMessage = "Connection failed";
    if (error instanceof Error) {
      if (error.message.includes("ENOTFOUND") || error.message.includes("ECONNREFUSED")) {
        errorMessage = "Cannot reach Cin7 API. Check your network connection.";
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
