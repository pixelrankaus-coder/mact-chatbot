import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

// POST /api/helpdesk/tickets/[id]/reply - Send a reply to a ticket
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ticketId } = await params;
    const supabase = getSupabase();
    const body = await request.json();

    const { content, is_internal_note = false, agent_name = "Chris" } = body;

    if (!content) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    // Get ticket to find conversation_id
    const { data: ticket, error: ticketError } = await supabase
      .from("helpdesk_tickets")
      .select("conversation_id, first_response_at")
      .eq("id", ticketId)
      .single();

    if (ticketError || !ticket) {
      return NextResponse.json(
        { error: "Ticket not found" },
        { status: 404 }
      );
    }

    // Create message
    const { data: message, error: messageError } = await supabase
      .from("messages")
      .insert({
        conversation_id: ticket.conversation_id,
        sender_type: "agent",
        sender_name: agent_name,
        content,
      })
      .select()
      .single();

    if (messageError) {
      console.error("Failed to create message:", messageError);
      return NextResponse.json(
        { error: "Failed to send reply" },
        { status: 500 }
      );
    }

    // Update ticket - set first_response_at if not already set
    const ticketUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (!ticket.first_response_at && !is_internal_note) {
      ticketUpdates.first_response_at = new Date().toISOString();

      // Calculate response time
      const { data: ticketData } = await supabase
        .from("helpdesk_tickets")
        .select("created_at")
        .eq("id", ticketId)
        .single();

      if (ticketData) {
        const created = new Date(ticketData.created_at).getTime();
        const now = Date.now();
        ticketUpdates.response_time_seconds = Math.floor((now - created) / 1000);
      }
    }

    await supabase
      .from("helpdesk_tickets")
      .update(ticketUpdates)
      .eq("id", ticketId);

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error("Reply error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
