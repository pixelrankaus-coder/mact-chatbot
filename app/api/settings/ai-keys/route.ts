import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

const INTEGRATION_TYPE = "ai_providers";

function maskKey(key: string): string {
  if (!key || key.length < 8) return key ? "••••••••" : "";
  return "••••••••" + key.slice(-4);
}

/**
 * GET /api/settings/ai-keys
 * Returns masked API keys and configuration status
 */
export async function GET() {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("integration_settings")
      .select("settings, is_enabled")
      .eq("integration_type", INTEGRATION_TYPE)
      .single();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    const settings = (data?.settings || {}) as Record<string, string>;

    return NextResponse.json({
      openai_api_key: maskKey(settings.openai_api_key || ""),
      anthropic_api_key: maskKey(settings.anthropic_api_key || ""),
      deepseek_api_key: maskKey(settings.deepseek_api_key || ""),
      has_openai: !!settings.openai_api_key,
      has_anthropic: !!settings.anthropic_api_key,
      has_deepseek: !!settings.deepseek_api_key,
      is_enabled: data?.is_enabled ?? false,
      // Also indicate if env vars are set
      env_openai: !!process.env.OPENAI_API_KEY,
      env_anthropic: !!process.env.ANTHROPIC_API_KEY,
      env_deepseek: !!process.env.DEEPSEEK_API_KEY,
    });
  } catch (error) {
    console.error("Failed to fetch AI keys:", error);
    return NextResponse.json({ error: "Failed to fetch AI keys" }, { status: 500 });
  }
}

/**
 * POST /api/settings/ai-keys
 * Save or test API keys
 * Body: { action: "save" | "test", ...data }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action = "save" } = body;

    if (action === "test") {
      return handleTest(body);
    }

    return handleSave(body);
  } catch (error) {
    console.error("Failed to process AI keys request:", error);
    return NextResponse.json({ error: "Request failed" }, { status: 500 });
  }
}

async function handleSave(body: Record<string, string>) {
  const supabase = createServiceClient();
  const { openai_api_key, anthropic_api_key, deepseek_api_key } = body;

  // Get existing settings to preserve masked values
  const { data: existing } = await supabase
    .from("integration_settings")
    .select("settings")
    .eq("integration_type", INTEGRATION_TYPE)
    .single();

  const existingSettings = (existing?.settings || {}) as Record<string, string>;

  // Only update keys that aren't masked (don't contain ••••)
  const newSettings: Record<string, string> = { ...existingSettings };

  if (openai_api_key && !openai_api_key.includes("••••")) {
    newSettings.openai_api_key = openai_api_key;
  }
  if (anthropic_api_key && !anthropic_api_key.includes("••••")) {
    newSettings.anthropic_api_key = anthropic_api_key;
  }
  if (deepseek_api_key && !deepseek_api_key.includes("••••")) {
    newSettings.deepseek_api_key = deepseek_api_key;
  }

  // Allow clearing keys by sending empty string
  if (openai_api_key === "") delete newSettings.openai_api_key;
  if (anthropic_api_key === "") delete newSettings.anthropic_api_key;
  if (deepseek_api_key === "") delete newSettings.deepseek_api_key;

  const { error } = await supabase.from("integration_settings").upsert(
    {
      integration_type: INTEGRATION_TYPE,
      settings: newSettings,
      is_enabled: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "integration_type" }
  );

  if (error) throw error;

  return NextResponse.json({
    success: true,
    openai_api_key: maskKey(newSettings.openai_api_key || ""),
    anthropic_api_key: maskKey(newSettings.anthropic_api_key || ""),
    deepseek_api_key: maskKey(newSettings.deepseek_api_key || ""),
    has_openai: !!newSettings.openai_api_key,
    has_anthropic: !!newSettings.anthropic_api_key,
    has_deepseek: !!newSettings.deepseek_api_key,
  });
}

async function handleTest(body: { provider: string }) {
  const { provider } = body;
  const supabase = createServiceClient();

  // Get key from DB first, then env
  const { data } = await supabase
    .from("integration_settings")
    .select("settings")
    .eq("integration_type", INTEGRATION_TYPE)
    .single();

  const settings = (data?.settings || {}) as Record<string, string>;

  let apiKey: string | undefined;
  let testUrl: string;
  let headers: Record<string, string>;

  switch (provider) {
    case "openai":
      apiKey = settings.openai_api_key || process.env.OPENAI_API_KEY;
      testUrl = "https://api.openai.com/v1/models";
      headers = { Authorization: `Bearer ${apiKey}` };
      break;
    case "anthropic":
      apiKey = settings.anthropic_api_key || process.env.ANTHROPIC_API_KEY;
      testUrl = "https://api.anthropic.com/v1/models";
      headers = {
        "x-api-key": apiKey || "",
        "anthropic-version": "2023-06-01",
      };
      break;
    case "deepseek":
      apiKey = settings.deepseek_api_key || process.env.DEEPSEEK_API_KEY;
      testUrl = "https://api.deepseek.com/v1/models";
      headers = { Authorization: `Bearer ${apiKey}` };
      break;
    default:
      return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }

  if (!apiKey) {
    return NextResponse.json({
      success: false,
      message: "No API key configured",
    });
  }

  try {
    const res = await fetch(testUrl, {
      headers,
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok || (provider === "anthropic" && res.status === 200)) {
      return NextResponse.json({
        success: true,
        message: `${provider} API key is valid`,
        responseTime: Date.now(),
      });
    }

    return NextResponse.json({
      success: false,
      message: `API returned HTTP ${res.status}`,
    });
  } catch (e) {
    return NextResponse.json({
      success: false,
      message: e instanceof Error ? e.message : "Connection failed",
    });
  }
}
