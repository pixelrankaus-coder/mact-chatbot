/**
 * Human Handoff Skill Handler
 * TASK: AI Agent Skills Tab - Phase 1
 *
 * Allows the AI to transfer conversations to human agents
 */

import { registerSkill, SkillContext, SkillResult } from "../index";
import { createServiceClient } from "@/lib/supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any;

interface HandoffParams {
  reason?: string;
  urgency?: "low" | "medium" | "high";
  summary?: string;
}

async function humanHandoffHandler(
  params: Record<string, unknown>,
  context: SkillContext
): Promise<SkillResult> {
  const { reason, urgency = "medium", summary } = params as HandoffParams;

  if (!context.conversationId) {
    return {
      success: false,
      error: "No conversation context available for handoff",
    };
  }

  const supabase = createServiceClient() as SupabaseAny;

  try {
    // Update conversation status to pending (awaiting human agent)
    const { error: updateError } = await supabase
      .from("conversations")
      .update({
        status: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", context.conversationId);

    if (updateError) throw updateError;

    // Add a system message about the handoff
    const handoffMessage = {
      conversation_id: context.conversationId,
      sender_type: "ai",
      sender_name: "System",
      content: `🔔 **Handoff Requested**\n\n${reason ? `**Reason:** ${reason}\n` : ""}${summary ? `**Summary:** ${summary}\n` : ""}**Priority:** ${urgency}\n\nA human agent will be with you shortly.`,
    };

    await supabase.from("messages").insert(handoffMessage);

    // TODO: In production, this would also:
    // - Send notification to available agents (Slack, email, push)
    // - Create helpdesk ticket if helpdesk is enabled
    // - Log handoff event for analytics

    return {
      success: true,
      data: {
        conversation_id: context.conversationId,
        status: "pending",
        urgency,
      },
      message:
        "I've requested a human agent to assist you. Someone will be with you shortly.",
    };
  } catch (error) {
    console.error("Human handoff error:", error);
    return {
      success: false,
      error: "Failed to initiate handoff. Please try again or contact support directly.",
    };
  }
}

// Register the skill
registerSkill({
  slug: "human_handoff",
  name: "Human Handoff",
  description:
    "Transfer the conversation to a human agent when the AI cannot help or when the customer requests human assistance.",
  parameters: {
    type: "object",
    properties: {
      reason: {
        type: "string",
        description: "Brief reason for the handoff (e.g., 'complex refund request', 'customer frustrated')",
      },
      urgency: {
        type: "string",
        description: "Priority level for the handoff",
        enum: ["low", "medium", "high"],
      },
      summary: {
        type: "string",
        description: "Summary of the conversation and what the customer needs help with",
      },
    },
  },
  handler: humanHandoffHandler,
});

export default humanHandoffHandler;
