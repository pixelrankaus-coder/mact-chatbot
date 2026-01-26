import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

// GET /api/helpdesk/tickets - List tickets with filters
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const searchParams = request.nextUrl.searchParams;

    const status = searchParams.get("status") || "open";
    const priority = searchParams.get("priority");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const perPage = parseInt(searchParams.get("per_page") || "50");

    // Build query - simple select without joins
    let query = supabase
      .from("helpdesk_tickets")
      .select("*", { count: "exact" })
      .order("updated_at", { ascending: false });

    // Apply status filter
    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    // Apply priority filter
    if (priority) {
      query = query.eq("priority", priority);
    }

    // Pagination
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;
    query = query.range(from, to);

    const { data: tickets, error, count } = await query;

    if (error) {
      console.error("Failed to fetch tickets:", error);
      return NextResponse.json(
        { error: "Failed to fetch tickets", details: error.message },
        { status: 500 }
      );
    }

    // Fetch conversation data for each ticket
    const ticketsWithConversations = await Promise.all(
      (tickets || []).map(async (ticket) => {
        if (!ticket.conversation_id) {
          return { ...ticket, conversation: null };
        }
        const { data: conversation } = await supabase
          .from("conversations")
          .select("id, visitor_id, visitor_name, visitor_email")
          .eq("id", ticket.conversation_id)
          .single();
        return { ...ticket, conversation: conversation || null };
      })
    );

    // Get stats
    const statsPromises = [
      supabase
        .from("helpdesk_tickets")
        .select("*", { count: "exact", head: true })
        .eq("status", "open"),
      supabase
        .from("helpdesk_tickets")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase
        .from("helpdesk_tickets")
        .select("*", { count: "exact", head: true })
        .eq("status", "snoozed"),
      supabase
        .from("helpdesk_tickets")
        .select("*", { count: "exact", head: true })
        .eq("status", "closed")
        .gte("closed_at", new Date(Date.now() - 86400000).toISOString()),
    ];

    const [openRes, pendingRes, snoozedRes, closedTodayRes] =
      await Promise.all(statsPromises);

    const stats = {
      open: openRes.count || 0,
      pending: pendingRes.count || 0,
      snoozed: snoozedRes.count || 0,
      closed_today: closedTodayRes.count || 0,
      avg_response_time: null,
      avg_resolution_time: null,
    };

    return NextResponse.json({
      tickets: ticketsWithConversations,
      total: count || 0,
      page,
      per_page: perPage,
      stats,
    });
  } catch (error) {
    console.error("Tickets list error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/helpdesk/tickets - Create a new ticket
export async function POST(request: Request) {
  try {
    const supabase = getSupabase();
    const body = await request.json();

    const {
      conversation_id,
      subject,
      priority = "normal",
      channel = "webchat",
      tag_ids = [],
      internal_notes,
    } = body;

    if (!conversation_id) {
      return NextResponse.json(
        { error: "conversation_id is required" },
        { status: 400 }
      );
    }

    // Get conversation details to link customer
    const { data: conversation } = await supabase
      .from("conversations")
      .select("customer_id, customer_email")
      .eq("id", conversation_id)
      .single();

    // Create ticket
    const { data: ticket, error } = await supabase
      .from("helpdesk_tickets")
      .insert({
        conversation_id,
        customer_id: conversation?.customer_id || null,
        subject,
        priority,
        channel,
        internal_notes,
        status: "open",
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to create ticket:", error);
      return NextResponse.json(
        { error: "Failed to create ticket" },
        { status: 500 }
      );
    }

    // Add tags if provided
    if (tag_ids.length > 0 && ticket) {
      const tagInserts = tag_ids.map((tag_id: string) => ({
        ticket_id: ticket.id,
        tag_id,
      }));

      await supabase.from("helpdesk_ticket_tags").insert(tagInserts);
    }

    // Update conversation with ticket reference
    await supabase
      .from("conversations")
      .update({
        helpdesk_ticket_id: ticket.id,
        needs_human: false,
        handed_off_at: new Date().toISOString(),
      })
      .eq("id", conversation_id);

    return NextResponse.json(ticket, { status: 201 });
  } catch (error) {
    console.error("Create ticket error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
