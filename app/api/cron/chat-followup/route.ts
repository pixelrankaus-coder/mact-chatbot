import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  extractChatContext,
  resolveProductUrl,
  createChatFollowUpCampaign,
} from "@/lib/chat/followup";

export const dynamic = "force-dynamic";

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

const MAX_PER_RUN = 5; // Cap at 5 conversations per cron run (~4s each = 20s total)
const IDLE_HOURS = 3; // Wait 3 hours of inactivity before following up
const MIN_MESSAGES = 2; // Require at least 2 non-system messages

// GET /api/cron/chat-followup - Process chat follow-up emails
export async function GET(request: NextRequest) {
  // Verify cron secret (same pattern as auto-resend)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isDev = process.env.NODE_ENV === "development";

  if (!isDev && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn("[Chat Followup] Unauthorized cron access attempt");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();
  const now = new Date();

  try {
    // Calculate cutoff: conversations idle for 3+ hours
    const cutoff = new Date(now.getTime() - IDLE_HOURS * 60 * 60 * 1000);

    // Find eligible conversations:
    // - Has visitor_email
    // - Status is active or pending (not yet resolved)
    // - Last updated 3+ hours ago
    // - No followup_sent in metadata
    const { data: conversations, error: fetchError } = await supabase
      .from("conversations")
      .select("id, visitor_name, visitor_email, metadata, updated_at")
      .not("visitor_email", "is", null)
      .neq("visitor_email", "")
      .in("status", ["active", "pending", "resolved"])
      .lt("updated_at", cutoff.toISOString())
      .order("updated_at", { ascending: true })
      .limit(MAX_PER_RUN * 2); // Fetch extra in case some get filtered out

    if (fetchError) {
      console.error("[Chat Followup] Failed to fetch conversations:", fetchError);
      return NextResponse.json(
        { error: "Database error", details: fetchError.message },
        { status: 500 }
      );
    }

    if (!conversations || conversations.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No eligible conversations for follow-up",
        processed: 0,
      });
    }

    // Filter out conversations that already have followup_sent
    const eligible = conversations.filter((c) => {
      const meta = (c.metadata as Record<string, unknown>) || {};
      return !meta.followup_sent;
    });

    console.log(
      `[Chat Followup] Found ${eligible.length} eligible conversations (from ${conversations.length} candidates)`
    );

    const results: Array<{
      conversation_id: string;
      email: string;
      status: string;
      campaign_id?: string;
      intent?: string;
      error?: string;
    }> = [];

    let processed = 0;

    for (const conversation of eligible) {
      if (processed >= MAX_PER_RUN) break;

      const email = conversation.visitor_email!;
      const name = conversation.visitor_name || "";

      // Fetch messages for this conversation
      const { data: messages, error: msgError } = await supabase
        .from("messages")
        .select("sender_type, content")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true });

      if (msgError || !messages) {
        console.error(
          `[Chat Followup] Failed to fetch messages for ${conversation.id}:`,
          msgError
        );
        results.push({
          conversation_id: conversation.id,
          email,
          status: "error",
          error: "Failed to fetch messages",
        });
        // Mark to avoid retrying every run
        await markFollowUpSent(supabase, conversation.id, conversation.metadata, "error_fetching_messages");
        continue;
      }

      // Filter non-system messages
      const userMessages = messages.filter(
        (m) => m.sender_type === "visitor" || m.sender_type === "ai" || m.sender_type === "agent"
      );

      if (userMessages.length < MIN_MESSAGES) {
        console.log(
          `[Chat Followup] Skipping ${conversation.id}: only ${userMessages.length} messages`
        );
        results.push({
          conversation_id: conversation.id,
          email,
          status: "skipped",
          error: "Too few messages",
        });
        await markFollowUpSent(supabase, conversation.id, conversation.metadata, "too_few_messages");
        continue;
      }

      // Extract context using LLM
      const context = await extractChatContext(messages);

      // Skip low-intent conversations
      if (context.intent_level === "low") {
        console.log(
          `[Chat Followup] Skipping ${conversation.id}: low intent`
        );
        results.push({
          conversation_id: conversation.id,
          email,
          status: "skipped",
          intent: "low",
        });
        await markFollowUpSent(supabase, conversation.id, conversation.metadata, "low_intent");
        continue;
      }

      // Resolve product URL
      const { url: productUrl, matchedProduct } = await resolveProductUrl(
        context.products_mentioned
      );

      // Create and send the follow-up campaign
      const result = await createChatFollowUpCampaign(
        conversation.id,
        email,
        name,
        context,
        productUrl,
        matchedProduct
      );

      if (result.success) {
        results.push({
          conversation_id: conversation.id,
          email,
          status: "sent",
          campaign_id: result.campaignId,
          intent: context.intent_level,
        });
        await markFollowUpSent(supabase, conversation.id, conversation.metadata, "sent", result.campaignId);
        processed++;
        console.log(
          `[Chat Followup] Sent follow-up to ${email} (intent: ${context.intent_level}, products: ${context.products_mentioned.join(", ")})`
        );
      } else {
        results.push({
          conversation_id: conversation.id,
          email,
          status: "failed",
          error: result.error,
        });
        await markFollowUpSent(supabase, conversation.id, conversation.metadata, "send_failed");
        console.error(
          `[Chat Followup] Failed to send to ${email}: ${result.error}`
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${processed} chat follow-ups`,
      processed,
      total_eligible: eligible.length,
      results,
    });
  } catch (error) {
    console.error("[Chat Followup] Cron error:", error);
    return NextResponse.json(
      {
        error: "Chat follow-up cron failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Allow POST for manual testing
export async function POST(request: NextRequest) {
  return GET(request);
}

/**
 * Marks a conversation with followup_sent in metadata to prevent re-processing.
 * Merges with existing metadata to avoid overwriting other fields.
 */
async function markFollowUpSent(
  supabase: ReturnType<typeof createClient>,
  conversationId: string,
  existingMetadata: unknown,
  reason: string,
  campaignId?: string
) {
  const meta = (existingMetadata as Record<string, unknown>) || {};
  const updatedMetadata = {
    ...meta,
    followup_sent: true,
    followup_sent_at: new Date().toISOString(),
    followup_reason: reason,
    ...(campaignId ? { followup_campaign_id: campaignId } : {}),
  };

  const { error } = await supabase
    .from("conversations")
    .update({ metadata: updatedMetadata })
    .eq("id", conversationId);

  if (error) {
    console.error(
      `[Chat Followup] Failed to update metadata for ${conversationId}:`,
      error
    );
  }
}
