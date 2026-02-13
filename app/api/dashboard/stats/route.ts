import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

/**
 * GET /api/dashboard/stats
 * Returns dashboard statistics filtered by date range.
 *
 * Query params:
 * - from: ISO date string (start of range)
 * - to: ISO date string (end of range)
 */
export async function GET(request: NextRequest) {
  const supabase = createServiceClient();

  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    // Build conversation query with date filtering
    let convQuery = supabase
      .from("conversations")
      .select("id, status, assigned_to, created_at, updated_at, metadata");

    if (from) convQuery = convQuery.gte("created_at", from);
    if (to) convQuery = convQuery.lte("created_at", to);

    const { data: conversations, error: convError } = await convQuery.order(
      "created_at",
      { ascending: false }
    );

    if (convError) throw convError;

    const allConvs = conversations || [];

    // Stats
    const totalConversations = allConvs.length;
    const activeConversations = allConvs.filter(
      (c) => c.status === "active" || c.status === "open"
    ).length;
    const resolvedConversations = allConvs.filter(
      (c) => c.status === "resolved" || c.status === "closed"
    ).length;
    const pendingConversations = allConvs.filter(
      (c) => c.status === "pending" || c.status === "waiting"
    ).length;

    // AI vs Human: conversations assigned_to 'ai' or with metadata
    const aiConversations = allConvs.filter(
      (c) => c.assigned_to === "ai" || c.assigned_to === "bot"
    ).length;
    const humanConversations = totalConversations - aiConversations;

    // AI resolution rate
    const aiResolutionRate =
      aiConversations > 0
        ? Math.round(
            (allConvs.filter(
              (c) =>
                (c.assigned_to === "ai" || c.assigned_to === "bot") &&
                (c.status === "resolved" || c.status === "closed")
            ).length /
              aiConversations) *
              100
          )
        : 0;

    // Group by day for chart
    const byDay: Record<string, { human: number; ai: number }> = {};
    for (const c of allConvs) {
      const day = c.created_at.substring(0, 10);
      if (!byDay[day]) byDay[day] = { human: 0, ai: 0 };
      if (c.assigned_to === "ai" || c.assigned_to === "bot") {
        byDay[day].ai++;
      } else {
        byDay[day].human++;
      }
    }

    const dailyConversations = Object.entries(byDay)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Recent conversations (last 10)
    const recentIds = allConvs.slice(0, 10).map((c) => c.id);

    let recentConversations: Array<{
      id: string;
      status: string;
      created_at: string;
      customer_name: string;
      customer_email: string;
      last_message: string;
    }> = [];

    if (recentIds.length > 0) {
      // Get latest message for each recent conversation
      const { data: messages } = await supabase
        .from("messages")
        .select("conversation_id, content, created_at")
        .in("conversation_id", recentIds)
        .order("created_at", { ascending: false });

      const lastMessages: Record<string, string> = {};
      for (const m of messages || []) {
        if (!lastMessages[m.conversation_id]) {
          lastMessages[m.conversation_id] = m.content;
        }
      }

      recentConversations = allConvs.slice(0, 10).map((c) => ({
        id: c.id,
        status: c.status,
        created_at: c.created_at,
        customer_name:
          (c.metadata as Record<string, string>)?.customer_name ||
          (c.metadata as Record<string, string>)?.name ||
          "Visitor",
        customer_email:
          (c.metadata as Record<string, string>)?.customer_email ||
          (c.metadata as Record<string, string>)?.email ||
          "",
        last_message: lastMessages[c.id] || "",
      }));
    }

    // Team status from agents
    const { data: agents } = await supabase
      .from("agents")
      .select("id, name, is_online, role");

    const teamStatus = (agents || []).map((a) => ({
      name: a.name || a.role,
      status: a.is_online ? "online" : "offline",
      role: a.role,
    }));

    return NextResponse.json({
      summary: {
        totalConversations,
        activeConversations,
        resolvedConversations,
        pendingConversations,
        aiConversations,
        humanConversations,
        aiResolutionRate,
      },
      dailyConversations,
      recentConversations,
      teamStatus,
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard stats" },
      { status: 500 }
    );
  }
}
