/**
 * Klaviyo Integration Settings API
 * TASK MACT #037
 *
 * GET: Fetch current Klaviyo settings
 * POST: Save Klaviyo settings or test connection
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any;

interface KlaviyoSettings {
  api_key: string;
  list_id: string;
}

const INTEGRATION_TYPE = "klaviyo";
const KLAVIYO_API_URL = "https://a.klaviyo.com/api";

/**
 * GET /api/settings/integrations/klaviyo
 * Returns current Klaviyo settings (with secrets masked)
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
        api_key: "",
        list_id: "",
        is_enabled: false,
        has_credentials: false,
      });
    }

    const settings = data.settings as KlaviyoSettings;

    // Return settings with API key masked
    return NextResponse.json({
      api_key: settings.api_key ? "pk_••••••••" + settings.api_key.slice(-6) : "",
      list_id: settings.list_id || "",
      is_enabled: data.is_enabled,
      has_credentials: !!(settings.api_key),
      updated_at: data.updated_at,
    });
  } catch (error) {
    console.error("Failed to fetch Klaviyo settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings/integrations/klaviyo
 * Save or test Klaviyo settings
 */
export async function POST(request: NextRequest) {
  const supabase = createServiceClient() as SupabaseAny;

  try {
    const body = await request.json();
    const { action, api_key, list_id, is_enabled } = body;

    // Handle test connection action
    if (action === "test") {
      return await testConnection(api_key, supabase);
    }

    // Handle fetch lists action
    if (action === "lists") {
      return await fetchLists(api_key, supabase);
    }

    // Get existing settings to preserve secrets if not provided
    const { data: existing } = await supabase
      .from("integration_settings")
      .select("settings")
      .eq("integration_type", INTEGRATION_TYPE)
      .single();

    const existingSettings = (existing?.settings || {}) as KlaviyoSettings;

    // Build new settings - only update API key if new one is provided
    const newSettings: KlaviyoSettings = {
      api_key: api_key && !api_key.includes("••••")
        ? api_key
        : existingSettings.api_key || "",
      list_id: list_id !== undefined ? list_id : existingSettings.list_id || "",
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
      message: "Klaviyo settings saved",
    });
  } catch (error) {
    console.error("Failed to save Klaviyo settings:", error);
    return NextResponse.json(
      { error: "Failed to save settings" },
      { status: 500 }
    );
  }
}

/**
 * Test Klaviyo connection with provided API key
 */
async function testConnection(
  apiKey: string,
  supabase: SupabaseAny
) {
  // If masked API key provided, fetch real one from DB
  let realApiKey = apiKey;

  if (apiKey?.includes("••••")) {
    const { data } = await supabase
      .from("integration_settings")
      .select("settings")
      .eq("integration_type", INTEGRATION_TYPE)
      .single();

    if (data?.settings) {
      const settings = data.settings as KlaviyoSettings;
      realApiKey = settings.api_key;
    }
  }

  if (!realApiKey) {
    return NextResponse.json(
      { success: false, error: "Missing API key" },
      { status: 400 }
    );
  }

  try {
    // Test by fetching account info
    const res = await fetch(`${KLAVIYO_API_URL}/accounts/`, {
      headers: {
        "Accept": "application/json",
        "Authorization": `Klaviyo-API-Key ${realApiKey}`,
        "revision": "2024-10-15",
      },
    });

    if (res.ok) {
      const data = await res.json();
      const account = data.data?.[0];
      return NextResponse.json({
        success: true,
        message: "Connection successful!",
        account_info: {
          name: account?.attributes?.contact_information?.organization_name || "Unknown",
          timezone: account?.attributes?.preferred_timezone,
        },
      });
    }

    // Parse error response
    let errorMessage = "Connection failed";

    if (res.status === 401) {
      errorMessage = "Invalid API key. Make sure you're using a Private API Key.";
    } else if (res.status === 403) {
      errorMessage = "Access denied. API key may lack required scopes.";
    } else {
      const errorText = await res.text();
      errorMessage = `API error (${res.status}): ${errorText.slice(0, 100)}`;
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 400 }
    );
  } catch (error) {
    console.error("Klaviyo connection test failed:", error);

    let errorMessage = "Connection failed";
    if (error instanceof Error) {
      if (error.message.includes("ENOTFOUND") || error.message.includes("ECONNREFUSED")) {
        errorMessage = "Cannot reach Klaviyo API. Check your network connection.";
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
 * Fetch available Klaviyo lists for selection
 */
async function fetchLists(
  apiKey: string,
  supabase: SupabaseAny
) {
  // If masked API key provided, fetch real one from DB
  let realApiKey = apiKey;

  if (apiKey?.includes("••••")) {
    const { data } = await supabase
      .from("integration_settings")
      .select("settings")
      .eq("integration_type", INTEGRATION_TYPE)
      .single();

    if (data?.settings) {
      const settings = data.settings as KlaviyoSettings;
      realApiKey = settings.api_key;
    }
  }

  if (!realApiKey) {
    return NextResponse.json(
      { success: false, error: "Missing API key" },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(`${KLAVIYO_API_URL}/lists/`, {
      headers: {
        "Accept": "application/json",
        "Authorization": `Klaviyo-API-Key ${realApiKey}`,
        "revision": "2024-10-15",
      },
    });

    if (res.ok) {
      const data = await res.json();
      const lists = data.data?.map((list: { id: string; attributes: { name: string } }) => ({
        id: list.id,
        name: list.attributes?.name || list.id,
      })) || [];

      return NextResponse.json({
        success: true,
        lists,
      });
    }

    return NextResponse.json(
      { success: false, error: "Failed to fetch lists", lists: [] },
      { status: 400 }
    );
  } catch (error) {
    console.error("Failed to fetch Klaviyo lists:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch lists", lists: [] },
      { status: 500 }
    );
  }
}
