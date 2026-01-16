import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Create supabase client at runtime for server-side usage
function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

interface TokenUsageRow {
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
  created_at: string;
}

/**
 * GET /api/stats/tokens
 * Get token usage statistics
 *
 * Query params:
 * - period: "day" | "week" | "month" | "all" (default: "month")
 * - conversationId: optional filter by conversation
 */
export async function GET(request: NextRequest) {
  const supabase = getSupabase();

  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "month";
    const conversationId = searchParams.get("conversationId");

    // Calculate date range
    const now = new Date();
    let startDate: Date | null = null;

    switch (period) {
      case "day":
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "all":
        startDate = null;
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Build query
    let query = supabase
      .from("token_usage")
      .select("model, prompt_tokens, completion_tokens, total_tokens, cost_usd, created_at");

    if (startDate) {
      query = query.gte("created_at", startDate.toISOString());
    }

    if (conversationId) {
      query = query.eq("conversation_id", conversationId);
    }

    const { data: usageData, error } = await query.order("created_at", { ascending: false });

    if (error) throw error;

    // Calculate aggregates
    const usage = (usageData || []) as TokenUsageRow[];
    const totalPromptTokens = usage.reduce((sum, u) => sum + u.prompt_tokens, 0);
    const totalCompletionTokens = usage.reduce((sum, u) => sum + u.completion_tokens, 0);
    const totalTokens = usage.reduce((sum, u) => sum + u.total_tokens, 0);
    const totalCost = usage.reduce((sum, u) => sum + Number(u.cost_usd || 0), 0);
    const requestCount = usage.length;

    // Group by model
    const byModel: Record<string, { requests: number; tokens: number; cost: number }> = {};
    for (const u of usage) {
      if (!byModel[u.model]) {
        byModel[u.model] = { requests: 0, tokens: 0, cost: 0 };
      }
      byModel[u.model].requests++;
      byModel[u.model].tokens += u.total_tokens;
      byModel[u.model].cost += Number(u.cost_usd || 0);
    }

    // Group by day for chart data
    const byDay: Record<string, { tokens: number; cost: number; requests: number }> = {};
    for (const u of usage) {
      const day = u.created_at.substring(0, 10); // YYYY-MM-DD
      if (!byDay[day]) {
        byDay[day] = { tokens: 0, cost: 0, requests: 0 };
      }
      byDay[day].tokens += u.total_tokens;
      byDay[day].cost += Number(u.cost_usd || 0);
      byDay[day].requests++;
    }

    // Convert byDay to sorted array
    const dailyUsage = Object.entries(byDay)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      period,
      summary: {
        totalPromptTokens,
        totalCompletionTokens,
        totalTokens,
        totalCost: Math.round(totalCost * 1000000) / 1000000, // 6 decimal places
        requestCount,
        averageTokensPerRequest: requestCount > 0 ? Math.round(totalTokens / requestCount) : 0,
        averageCostPerRequest: requestCount > 0 ? Math.round((totalCost / requestCount) * 1000000) / 1000000 : 0,
      },
      byModel,
      dailyUsage,
    });
  } catch (error) {
    console.error("Failed to fetch token stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch token statistics" },
      { status: 500 }
    );
  }
}
