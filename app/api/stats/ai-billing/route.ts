import { NextResponse } from "next/server";
import { getApiKey } from "@/lib/llm";

interface ProviderBilling {
  provider: string;
  available: boolean;
  balance?: number;
  currency?: string;
  message?: string;
  dashboardUrl: string;
}

async function getDeepSeekBalance(): Promise<ProviderBilling> {
  const apiKey = await getApiKey("deepseek");
  if (!apiKey) {
    return {
      provider: "deepseek",
      available: false,
      message: "API key not configured",
      dashboardUrl: "https://platform.deepseek.com/usage",
    };
  }

  try {
    const res = await fetch("https://api.deepseek.com/user/balance", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return {
        provider: "deepseek",
        available: false,
        message: `API returned HTTP ${res.status}`,
        dashboardUrl: "https://platform.deepseek.com/usage",
      };
    }

    const data = await res.json();
    // DeepSeek returns { balance_infos: [{ currency: "CNY", total_balance: "...", ... }] }
    const balanceInfo = data.balance_infos?.[0];
    const balance = balanceInfo ? parseFloat(balanceInfo.total_balance) : undefined;

    return {
      provider: "deepseek",
      available: true,
      balance,
      currency: balanceInfo?.currency || "CNY",
      dashboardUrl: "https://platform.deepseek.com/usage",
    };
  } catch (e) {
    return {
      provider: "deepseek",
      available: false,
      message: e instanceof Error ? e.message : "Connection failed",
      dashboardUrl: "https://platform.deepseek.com/usage",
    };
  }
}

async function getOpenAIBilling(): Promise<ProviderBilling> {
  const apiKey = await getApiKey("openai");
  if (!apiKey) {
    return {
      provider: "openai",
      available: false,
      message: "API key not configured",
      dashboardUrl: "https://platform.openai.com/usage",
    };
  }

  // OpenAI doesn't expose billing via API for most accounts
  return {
    provider: "openai",
    available: false,
    message: "View usage on OpenAI dashboard",
    dashboardUrl: "https://platform.openai.com/usage",
  };
}

async function getAnthropicBilling(): Promise<ProviderBilling> {
  const apiKey = await getApiKey("anthropic");
  if (!apiKey) {
    return {
      provider: "anthropic",
      available: false,
      message: "API key not configured",
      dashboardUrl: "https://console.anthropic.com/settings/billing",
    };
  }

  // Anthropic doesn't expose billing via public API
  return {
    provider: "anthropic",
    available: false,
    message: "View usage on Anthropic dashboard",
    dashboardUrl: "https://console.anthropic.com/settings/billing",
  };
}

export async function GET() {
  try {
    const [openai, anthropic, deepseek] = await Promise.all([
      getOpenAIBilling(),
      getAnthropicBilling(),
      getDeepSeekBalance(),
    ]);

    return NextResponse.json({
      providers: [openai, anthropic, deepseek],
    });
  } catch (error) {
    console.error("Failed to fetch AI billing:", error);
    return NextResponse.json(
      { error: "Failed to fetch billing data" },
      { status: 500 }
    );
  }
}
