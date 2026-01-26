import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

// GET /api/helpdesk/tickets/[id] - Get single ticket with messages
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabase();

    // Get ticket (simple query without join)
    const { data: ticket, error } = await supabase
      .from("helpdesk_tickets")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !ticket) {
      return NextResponse.json(
        { error: "Ticket not found" },
        { status: 404 }
      );
    }

    // Get conversation data separately
    const { data: conversation } = await supabase
      .from("conversations")
      .select("id, visitor_id, visitor_name, visitor_email, status, created_at")
      .eq("id", ticket.conversation_id)
      .single();

    // Get messages for this conversation
    const { data: messages } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", ticket.conversation_id)
      .order("created_at", { ascending: true });

    // Combine ticket with conversation and messages
    const transformedTicket = {
      ...ticket,
      conversation: conversation || null,
      messages: messages || [],
    };

    return NextResponse.json(transformedTicket);
  } catch (error) {
    console.error("Get ticket error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/helpdesk/tickets/[id] - Update ticket
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabase();
    const updates = await request.json();

    // Prepare update object
    const ticketUpdates: Record<string, unknown> = {};

    if (updates.status !== undefined) {
      ticketUpdates.status = updates.status;
      if (updates.status === "closed") {
        ticketUpdates.closed_at = new Date().toISOString();
        // Calculate resolution time
        const { data: ticket } = await supabase
          .from("helpdesk_tickets")
          .select("created_at")
          .eq("id", id)
          .single();
        if (ticket) {
          const created = new Date(ticket.created_at).getTime();
          const now = Date.now();
          ticketUpdates.resolution_time_seconds = Math.floor(
            (now - created) / 1000
          );
        }
      }
    }

    if (updates.priority !== undefined) {
      ticketUpdates.priority = updates.priority;
    }

    if (updates.subject !== undefined) {
      ticketUpdates.subject = updates.subject;
    }

    if (updates.internal_notes !== undefined) {
      ticketUpdates.internal_notes = updates.internal_notes;
    }

    if (updates.snoozed_until !== undefined) {
      ticketUpdates.snoozed_until = updates.snoozed_until;
      if (updates.snoozed_until) {
        ticketUpdates.status = "snoozed";
      }
    }

    if (updates.assigned_to !== undefined) {
      ticketUpdates.assigned_to = updates.assigned_to;
    }

    // Update ticket
    const { data: ticket, error } = await supabase
      .from("helpdesk_tickets")
      .update(ticketUpdates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Failed to update ticket:", error);
      return NextResponse.json(
        { error: "Failed to update ticket" },
        { status: 500 }
      );
    }

    // Handle tag updates if provided
    if (updates.tag_ids !== undefined) {
      // Remove existing tags
      await supabase.from("helpdesk_ticket_tags").delete().eq("ticket_id", id);

      // Add new tags
      if (updates.tag_ids.length > 0) {
        const tagInserts = updates.tag_ids.map((tag_id: string) => ({
          ticket_id: id,
          tag_id,
        }));
        await supabase.from("helpdesk_ticket_tags").insert(tagInserts);
      }
    }

    return NextResponse.json(ticket);
  } catch (error) {
    console.error("Update ticket error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
