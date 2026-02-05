import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

// GET /api/helpdesk/tickets/[id]/context - Get customer context for ticket
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabase();

    // Get ticket
    const { data: ticket, error: ticketError } = await supabase
      .from("helpdesk_tickets")
      .select("*")
      .eq("id", id)
      .single();

    if (ticketError || !ticket) {
      return NextResponse.json(
        { error: "Ticket not found" },
        { status: 404 }
      );
    }

    // Get conversation separately
    let conversation = null;
    if (ticket.conversation_id) {
      const { data: conv } = await supabase
        .from("conversations")
        .select("id, visitor_id, visitor_email, visitor_name")
        .eq("id", ticket.conversation_id)
        .single();
      conversation = conv;
    }

    const customerEmail = conversation?.visitor_email;
    const customerId = ticket.customer_id || conversation?.visitor_id;

    // Build context object
    const context: {
      woo_customer: unknown | null;
      cin7_customer: unknown | null;
      recent_orders: unknown[];
      previous_tickets: unknown[];
      conversation_stats: {
        total_conversations: number;
        total_messages: number;
        first_contact: string | null;
        last_contact: string | null;
      };
    } = {
      woo_customer: null,
      cin7_customer: null,
      recent_orders: [],
      previous_tickets: [],
      conversation_stats: {
        total_conversations: 0,
        total_messages: 0,
        first_contact: null,
        last_contact: null,
      },
    };

    // Fetch WooCommerce customer
    if (customerId) {
      const { data: wooCustomer } = await supabase
        .from("woo_customers")
        .select("*")
        .eq("id", customerId)
        .single();

      if (wooCustomer) {
        context.woo_customer = {
          id: wooCustomer.id,
          email: wooCustomer.email,
          first_name: wooCustomer.first_name,
          last_name: wooCustomer.last_name,
          company: wooCustomer.company,
          phone: wooCustomer.phone,
          billing_address: wooCustomer.billing,
          date_created: wooCustomer.date_created,
          total_spent: wooCustomer.total_spent,
          orders_count: wooCustomer.orders_count,
        };
      }
    } else if (customerEmail) {
      // Try to find by email
      const { data: wooCustomer } = await supabase
        .from("woo_customers")
        .select("*")
        .eq("email", customerEmail)
        .single();

      if (wooCustomer) {
        context.woo_customer = {
          id: wooCustomer.id,
          email: wooCustomer.email,
          first_name: wooCustomer.first_name,
          last_name: wooCustomer.last_name,
          company: wooCustomer.company,
          phone: wooCustomer.phone,
          billing_address: wooCustomer.billing,
          date_created: wooCustomer.date_created,
          total_spent: wooCustomer.total_spent,
          orders_count: wooCustomer.orders_count,
        };
      }
    }

    // Fetch Cin7 customer
    if (ticket.cin7_customer_id) {
      const { data: cin7Customer } = await supabase
        .from("cin7_customers")
        .select("*")
        .eq("id", ticket.cin7_customer_id)
        .single();

      if (cin7Customer) {
        context.cin7_customer = {
          id: cin7Customer.id,
          company_name: cin7Customer.company,
          contact_name: cin7Customer.first_name
            ? `${cin7Customer.first_name} ${cin7Customer.last_name || ""}`
            : null,
          email: cin7Customer.email,
          phone: cin7Customer.phone,
          price_tier: cin7Customer.price_tier,
          credit_limit: cin7Customer.credit_limit,
          balance: cin7Customer.balance,
        };
      }
    } else if (customerEmail) {
      // Try to find Cin7 customer by email
      const { data: cin7Customer } = await supabase
        .from("cin7_customers")
        .select("*")
        .eq("email", customerEmail)
        .single();

      if (cin7Customer) {
        context.cin7_customer = {
          id: cin7Customer.id,
          company_name: cin7Customer.company,
          contact_name: cin7Customer.first_name
            ? `${cin7Customer.first_name} ${cin7Customer.last_name || ""}`
            : null,
          email: cin7Customer.email,
          phone: cin7Customer.phone,
          price_tier: cin7Customer.price_tier,
          credit_limit: cin7Customer.credit_limit,
          balance: cin7Customer.balance,
        };
      }
    }

    // Fetch recent orders
    if (customerId || customerEmail) {
      let ordersQuery = supabase
        .from("woo_orders")
        .select("id, number, status, total, currency, date_created, line_items")
        .order("date_created", { ascending: false })
        .limit(5);

      if (customerId) {
        ordersQuery = ordersQuery.eq("customer_id", customerId);
      } else if (customerEmail) {
        ordersQuery = ordersQuery.eq("billing_email", customerEmail);
      }

      const { data: orders } = await ordersQuery;

      if (orders) {
        context.recent_orders = orders.map((order) => ({
          id: order.id,
          order_number: order.number,
          status: order.status,
          total: parseFloat(order.total || "0"),
          currency: order.currency || "NZD",
          date_created: order.date_created,
          line_items: Array.isArray(order.line_items)
            ? order.line_items.slice(0, 3).map((item: { name?: string; quantity?: number; total?: string }) => ({
                name: item.name,
                quantity: item.quantity,
                total: parseFloat(item.total || "0"),
              }))
            : [],
        }));
      }
    }

    // Fetch previous tickets
    if (customerId || customerEmail) {
      let ticketsQuery = supabase
        .from("helpdesk_tickets")
        .select("id, subject, status, created_at, closed_at")
        .neq("id", id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (customerId) {
        ticketsQuery = ticketsQuery.eq("customer_id", customerId);
      }

      const { data: previousTickets } = await ticketsQuery;

      if (previousTickets) {
        context.previous_tickets = previousTickets;
      }
    }

    // Get conversation stats
    if (customerEmail) {
      const { data: conversations, count } = await supabase
        .from("conversations")
        .select("id, created_at", { count: "exact" })
        .eq("visitor_email", customerEmail)
        .order("created_at", { ascending: true });

      if (conversations && conversations.length > 0) {
        context.conversation_stats.total_conversations = count || 0;
        context.conversation_stats.first_contact = conversations[0].created_at;
        context.conversation_stats.last_contact =
          conversations[conversations.length - 1].created_at;

        // Count total messages
        const conversationIds = conversations.map((c) => c.id);
        const { count: messageCount } = await supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .in("conversation_id", conversationIds);

        context.conversation_stats.total_messages = messageCount || 0;
      }
    }

    return NextResponse.json(context);
  } catch (error) {
    console.error("Get context error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
