import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Create supabase client with service role for admin operations
function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * POST /api/conversations/auto-resolve
 *
 * Auto-resolves inactive chats after 24 hours of inactivity.
 * This endpoint is designed to be called by a cron job (e.g., hourly).
 *
 * Task 043: Auto-Resolve Chats After 24h
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();

    // Calculate 24 hours ago
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
    const cutoffTime = twentyFourHoursAgo.toISOString();

    // Find all active/pending conversations with updated_at older than 24 hours
    const { data: inactiveConversations, error: fetchError } = await supabase
      .from("conversations")
      .select("id, visitor_name, visitor_email, status, updated_at")
      .in("status", ["active", "pending"])
      .lt("updated_at", cutoffTime);

    if (fetchError) {
      console.error("Failed to fetch inactive conversations:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch conversations", details: fetchError.message },
        { status: 500 }
      );
    }

    if (!inactiveConversations || inactiveConversations.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No inactive conversations to resolve",
        resolved: 0,
      });
    }

    // Update all inactive conversations to resolved
    const conversationIds = inactiveConversations.map((c) => c.id);
    const now = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("conversations")
      .update({
        status: "resolved",
        resolved_at: now,
      })
      .in("id", conversationIds);

    if (updateError) {
      console.error("Failed to update conversations:", updateError);
      return NextResponse.json(
        { error: "Failed to resolve conversations", details: updateError.message },
        { status: 500 }
      );
    }

    console.log(`[Auto-resolve] Resolved ${conversationIds.length} inactive conversations`);

    return NextResponse.json({
      success: true,
      message: `Auto-resolved ${conversationIds.length} inactive conversations`,
      resolved: conversationIds.length,
      conversationIds,
    });
  } catch (error) {
    console.error("Auto-resolve error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/conversations/auto-resolve
 *
 * Returns information about which conversations would be auto-resolved.
 * Useful for previewing before running the actual resolution.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();

    // Calculate 24 hours ago
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
    const cutoffTime = twentyFourHoursAgo.toISOString();

    // Find all active/pending conversations with updated_at older than 24 hours
    const { data: inactiveConversations, error: fetchError } = await supabase
      .from("conversations")
      .select("id, visitor_name, visitor_email, status, updated_at")
      .in("status", ["active", "pending"])
      .lt("updated_at", cutoffTime);

    if (fetchError) {
      return NextResponse.json(
        { error: "Failed to fetch conversations", details: fetchError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      cutoffTime,
      wouldResolve: inactiveConversations?.length || 0,
      conversations: inactiveConversations || [],
    });
  } catch (error) {
    console.error("Auto-resolve preview error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
