/**
 * Helpdesk Tickets Skill Handler
 * TASK: AI Agent Skills Tab - Phase 1
 *
 * Allows the AI to create support tickets from chat conversations
 */

import { registerSkill, SkillContext, SkillResult } from "../index";
import { createServiceClient } from "@/lib/supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any;

interface CreateTicketParams {
  subject: string;
  description: string;
  priority?: "low" | "normal" | "high" | "urgent";
  category?: string;
}

async function helpdeskHandler(
  params: Record<string, unknown>,
  context: SkillContext
): Promise<SkillResult> {
  const { subject, description, priority = "normal", category } = params as unknown as CreateTicketParams;

  if (!subject || !description) {
    return {
      success: false,
      error: "Subject and description are required to create a ticket",
    };
  }

  const supabase = createServiceClient() as SupabaseAny;

  try {
    // Create the helpdesk ticket
    const ticketData = {
      subject,
      description,
      priority,
      category: category || "general",
      status: "open",
      source: "chat",
      conversation_id: context.conversationId || null,
      customer_email: context.visitorEmail || null,
      customer_name: context.visitorName || null,
      created_at: new Date().toISOString(),
    };

    const { data: ticket, error } = await supabase
      .from("helpdesk_tickets")
      .insert(ticketData)
      .select("id, ticket_number")
      .single();

    if (error) {
      // Table might not exist yet - check if it's a relation error
      if (error.message?.includes("relation") || error.code === "42P01") {
        return {
          success: false,
          error: "Helpdesk system is not configured. Please contact support.",
        };
      }
      throw error;
    }

    return {
      success: true,
      data: {
        ticket_id: ticket.id,
        ticket_number: ticket.ticket_number,
        subject,
        priority,
        status: "open",
      },
      message: `I've created support ticket #${ticket.ticket_number || ticket.id.slice(0, 8)} for you. Our team will review it and get back to you soon.`,
    };
  } catch (error) {
    console.error("Helpdesk ticket creation error:", error);
    return {
      success: false,
      error: "Failed to create support ticket. Please try again or email support directly.",
    };
  }
}

// Register the skill
registerSkill({
  slug: "helpdesk",
  name: "Helpdesk Tickets",
  description:
    "Create a support ticket to track and follow up on customer issues. Use this when a customer has a problem that needs to be tracked or escalated.",
  parameters: {
    type: "object",
    properties: {
      subject: {
        type: "string",
        description: "Brief subject line for the ticket",
      },
      description: {
        type: "string",
        description: "Detailed description of the issue or request",
      },
      priority: {
        type: "string",
        description: "Priority level of the ticket",
        enum: ["low", "normal", "high", "urgent"],
      },
      category: {
        type: "string",
        description: "Category of the ticket (e.g., 'billing', 'technical', 'shipping')",
      },
    },
    required: ["subject", "description"],
  },
  handler: helpdeskHandler,
});

export default helpdeskHandler;
