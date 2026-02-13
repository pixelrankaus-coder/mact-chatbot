import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { getApiKey } from "@/lib/llm";

interface ServiceHealth {
  name: string;
  type: "database" | "ai" | "integration" | "email" | "advertising";
  status: "operational" | "degraded" | "down" | "unconfigured";
  responseTime: number | null;
  details?: string;
  url?: string;
}

async function checkSupabase(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("settings").select("id").limit(1);
    const responseTime = Date.now() - start;
    if (error) throw error;
    return {
      name: "Supabase",
      type: "database",
      status: "operational",
      responseTime,
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    };
  } catch (e: unknown) {
    return {
      name: "Supabase",
      type: "database",
      status: "down",
      responseTime: Date.now() - start,
      details: e instanceof Error ? e.message : "Connection failed",
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    };
  }
}

async function checkOpenAI(): Promise<ServiceHealth> {
  const apiKey = await getApiKey("openai");
  if (!apiKey) {
    return { name: "OpenAI", type: "ai", status: "unconfigured", responseTime: null, details: "API key not set" };
  }
  const start = Date.now();
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000),
    });
    const responseTime = Date.now() - start;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { name: "OpenAI", type: "ai", status: "operational", responseTime, url: "https://api.openai.com" };
  } catch (e: unknown) {
    return {
      name: "OpenAI",
      type: "ai",
      status: "down",
      responseTime: Date.now() - start,
      details: e instanceof Error ? e.message : "Connection failed",
      url: "https://api.openai.com",
    };
  }
}

async function checkAnthropic(): Promise<ServiceHealth> {
  const apiKey = await getApiKey("anthropic");
  if (!apiKey) {
    return { name: "Anthropic", type: "ai", status: "unconfigured", responseTime: null, details: "API key not set" };
  }
  const start = Date.now();
  try {
    // Anthropic doesn't have a simple list endpoint, so we ping the API root
    const res = await fetch("https://api.anthropic.com/v1/models", {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      signal: AbortSignal.timeout(10000),
    });
    const responseTime = Date.now() - start;
    // 200 = good, 401 = bad key but API is up
    if (res.ok || res.status === 401) {
      return {
        name: "Anthropic",
        type: "ai",
        status: res.ok ? "operational" : "degraded",
        responseTime,
        details: res.ok ? undefined : "Invalid API key",
        url: "https://api.anthropic.com",
      };
    }
    throw new Error(`HTTP ${res.status}`);
  } catch (e: unknown) {
    return {
      name: "Anthropic",
      type: "ai",
      status: "down",
      responseTime: Date.now() - start,
      details: e instanceof Error ? e.message : "Connection failed",
      url: "https://api.anthropic.com",
    };
  }
}

async function checkDeepSeek(): Promise<ServiceHealth> {
  const apiKey = await getApiKey("deepseek");
  if (!apiKey) {
    return { name: "DeepSeek", type: "ai", status: "unconfigured", responseTime: null, details: "API key not set" };
  }
  const start = Date.now();
  try {
    const res = await fetch("https://api.deepseek.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000),
    });
    const responseTime = Date.now() - start;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { name: "DeepSeek", type: "ai", status: "operational", responseTime, url: "https://api.deepseek.com" };
  } catch (e: unknown) {
    return {
      name: "DeepSeek",
      type: "ai",
      status: "down",
      responseTime: Date.now() - start,
      details: e instanceof Error ? e.message : "Connection failed",
      url: "https://api.deepseek.com",
    };
  }
}

async function checkWooCommerce(): Promise<ServiceHealth> {
  // DB-first: check integration_settings before env vars
  let wooUrl = "";
  let wooKey = "";
  let wooSecret = "";

  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("integration_settings")
      .select("settings, is_enabled")
      .eq("integration_type", "woocommerce")
      .single();

    if (data?.is_enabled && data.settings?.url && data.settings?.consumer_key && data.settings?.consumer_secret) {
      wooUrl = data.settings.url;
      wooKey = data.settings.consumer_key;
      wooSecret = data.settings.consumer_secret;
    }
  } catch {
    // Fall through to env vars
  }

  // Fall back to env vars if DB didn't have credentials
  if (!wooUrl) {
    wooUrl = process.env.WOOCOMMERCE_URL || "";
    wooKey = process.env.WOOCOMMERCE_CONSUMER_KEY || "";
    wooSecret = process.env.WOOCOMMERCE_CONSUMER_SECRET || "";
  }

  if (!wooUrl || !wooKey || !wooSecret) {
    return { name: "WooCommerce", type: "integration", status: "unconfigured", responseTime: null, details: "Not configured" };
  }

  const start = Date.now();
  try {
    const auth = Buffer.from(`${wooKey}:${wooSecret}`).toString("base64");
    const res = await fetch(`${wooUrl}/wp-json/wc/v3/products?per_page=1`, {
      headers: { Authorization: `Basic ${auth}` },
      signal: AbortSignal.timeout(10000),
    });
    const responseTime = Date.now() - start;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { name: "WooCommerce", type: "integration", status: "operational", responseTime, url: wooUrl };
  } catch (e: unknown) {
    return {
      name: "WooCommerce",
      type: "integration",
      status: "down",
      responseTime: Date.now() - start,
      details: e instanceof Error ? e.message : "Connection failed",
      url: wooUrl,
    };
  }
}

async function checkCin7(): Promise<ServiceHealth> {
  const accountId = process.env.CIN7_ACCOUNT_ID;
  const apiKey = process.env.CIN7_API_KEY;
  if (!accountId || !apiKey) {
    // Check integration_settings
    try {
      const supabase = createServiceClient();
      const { data } = await supabase
        .from("integration_settings")
        .select("settings")
        .eq("integration_type", "cin7")
        .single();
      if (!data?.settings?.account_id) {
        return { name: "Cin7", type: "integration", status: "unconfigured", responseTime: null, details: "Not configured" };
      }
      const start = Date.now();
      const res = await fetch("https://inventory.dearsystems.com/ExternalApi/v2/me", {
        headers: {
          "api-auth-accountid": data.settings.account_id,
          "api-auth-applicationkey": data.settings.api_key,
        },
        signal: AbortSignal.timeout(10000),
      });
      const responseTime = Date.now() - start;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { name: "Cin7", type: "integration", status: "operational", responseTime, url: "https://inventory.dearsystems.com" };
    } catch (e: unknown) {
      return {
        name: "Cin7",
        type: "integration",
        status: "down",
        responseTime: null,
        details: e instanceof Error ? e.message : "Connection failed",
      };
    }
  }

  const start = Date.now();
  try {
    const res = await fetch("https://inventory.dearsystems.com/ExternalApi/v2/me", {
      headers: {
        "api-auth-accountid": accountId,
        "api-auth-applicationkey": apiKey,
      },
      signal: AbortSignal.timeout(10000),
    });
    const responseTime = Date.now() - start;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { name: "Cin7", type: "integration", status: "operational", responseTime, url: "https://inventory.dearsystems.com" };
  } catch (e: unknown) {
    return {
      name: "Cin7",
      type: "integration",
      status: "down",
      responseTime: Date.now() - start,
      details: e instanceof Error ? e.message : "Connection failed",
      url: "https://inventory.dearsystems.com",
    };
  }
}

async function checkKlaviyo(): Promise<ServiceHealth> {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("integration_settings")
      .select("settings")
      .eq("integration_type", "klaviyo")
      .single();

    if (!data?.settings?.api_key) {
      return { name: "Klaviyo", type: "email", status: "unconfigured", responseTime: null, details: "Not configured" };
    }

    const start = Date.now();
    const res = await fetch("https://a.klaviyo.com/api/accounts/", {
      headers: {
        Authorization: `Klaviyo-API-Key ${data.settings.api_key}`,
        revision: "2024-10-15",
      },
      signal: AbortSignal.timeout(10000),
    });
    const responseTime = Date.now() - start;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { name: "Klaviyo", type: "email", status: "operational", responseTime, url: "https://a.klaviyo.com" };
  } catch (e: unknown) {
    return {
      name: "Klaviyo",
      type: "email",
      status: "down",
      responseTime: null,
      details: e instanceof Error ? e.message : "Connection failed",
      url: "https://a.klaviyo.com",
    };
  }
}

async function checkResend(): Promise<ServiceHealth> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { name: "Resend", type: "email", status: "unconfigured", responseTime: null, details: "API key not set" };
  }
  const start = Date.now();
  try {
    const res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000),
    });
    const responseTime = Date.now() - start;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { name: "Resend", type: "email", status: "operational", responseTime, url: "https://api.resend.com" };
  } catch (e: unknown) {
    return {
      name: "Resend",
      type: "email",
      status: "down",
      responseTime: Date.now() - start,
      details: e instanceof Error ? e.message : "Connection failed",
      url: "https://api.resend.com",
    };
  }
}

async function checkGoogleAds(): Promise<ServiceHealth> {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("ppc_connections")
      .select("id, customer_id, is_active, sync_status")
      .eq("is_active", true)
      .limit(1)
      .single();

    if (!data || data.customer_id === "pending") {
      return {
        name: "Google Ads",
        type: "advertising",
        status: "unconfigured",
        responseTime: null,
        details: data ? "Account selection pending" : "Not connected",
      };
    }

    return {
      name: "Google Ads",
      type: "advertising",
      status: data.sync_status === "error" ? "degraded" : "operational",
      responseTime: null,
      details: data.sync_status === "error" ? "Last sync had errors" : undefined,
      url: "https://ads.google.com",
    };
  } catch {
    return {
      name: "Google Ads",
      type: "advertising",
      status: "unconfigured",
      responseTime: null,
      details: "Not connected",
    };
  }
}

export async function GET() {
  try {
    const startTime = Date.now();

    // Run all health checks in parallel
    const results = await Promise.allSettled([
      checkSupabase(),
      checkOpenAI(),
      checkAnthropic(),
      checkDeepSeek(),
      checkWooCommerce(),
      checkCin7(),
      checkKlaviyo(),
      checkResend(),
      checkGoogleAds(),
    ]);

    const services: ServiceHealth[] = results.map((result) => {
      if (result.status === "fulfilled") return result.value;
      return {
        name: "Unknown",
        type: "integration" as const,
        status: "down" as const,
        responseTime: null,
        details: result.reason?.message || "Check failed",
      };
    });

    const totalTime = Date.now() - startTime;
    const operational = services.filter((s) => s.status === "operational").length;
    const configured = services.filter((s) => s.status !== "unconfigured").length;

    return NextResponse.json({
      services,
      summary: {
        total: services.length,
        operational,
        degraded: services.filter((s) => s.status === "degraded").length,
        down: services.filter((s) => s.status === "down").length,
        unconfigured: services.filter((s) => s.status === "unconfigured").length,
        configured,
      },
      checkedAt: new Date().toISOString(),
      totalCheckTime: totalTime,
    });
  } catch (error) {
    console.error("Infrastructure health check error:", error);
    return NextResponse.json(
      { error: "Health check failed" },
      { status: 500 }
    );
  }
}
