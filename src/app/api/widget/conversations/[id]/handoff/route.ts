import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendHandoffRequestEmail } from "@/lib/email";
import { trackChatEvent } from "@/lib/klaviyo";

// Create supabase client at runtime for server-side usage
function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

// CORS headers for widget
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/**
 * Check if current time is within operating hours
 */
function isWithinOperatingHours(operatingHours: Record<string, unknown> | null): boolean {
  if (!operatingHours || operatingHours.enabled === false) {
    return true; // If not configured, assume always available
  }

  const timezone = (operatingHours.timezone as string) || "Australia/Perth";
  const schedule = operatingHours.schedule as Array<{
    day: string;
    enabled: boolean;
    start: string;
    end: string;
  }>;

  if (!schedule) return true;

  // Get current time in the specified timezone
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value || "";
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0");
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value || "0");
  const currentMinutes = hour * 60 + minute;

  // Find today's schedule
  const todaySchedule = schedule.find(
    (s) => s.day.toLowerCase() === weekday.toLowerCase()
  );

  if (!todaySchedule || !todaySchedule.enabled) {
    return false;
  }

  // Parse start and end times
  const parseTime = (timeStr: string): number => {
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (!match) return 0;
    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const period = match[3]?.toUpperCase();

    if (period === "PM" && hours !== 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;

    return hours * 60 + minutes;
  };

  const startMinutes = parseTime(todaySchedule.start);
  const endMinutes = parseTime(todaySchedule.end);

  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

/**
 * POST /api/widget/conversations/[id]/handoff
 * Request human handoff for a conversation
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = getSupabase();

  try {
    const { id } = await params;
    const body = await request.json();
    const { visitorName, visitorEmail, message, reason } = body;

    // Verify conversation exists
    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", id)
      .single();

    if (convError || !conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    // Get operating hours
    const { data: hoursSettings } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "operating_hours")
      .single();

    const operatingHours = hoursSettings?.value as Record<string, unknown> | null;
    const withinHours = isWithinOperatingHours(operatingHours);

    // Update conversation status and visitor info
    const updateData: Record<string, unknown> = {
      status: "pending",
      updated_at: new Date().toISOString(),
      needs_human: true,
      handed_off_at: new Date().toISOString(),
    };

    if (visitorName) updateData.visitor_name = visitorName;
    if (visitorEmail) updateData.visitor_email = visitorEmail;

    const { error: updateError } = await supabase
      .from("conversations")
      .update(updateData)
      .eq("id", id);

    if (updateError) throw updateError;

    // Create helpdesk ticket for this conversation
    const ticketSubject = reason || message || "Customer requested human support";
    const { data: ticket, error: ticketError } = await supabase
      .from("helpdesk_tickets")
      .insert({
        conversation_id: id,
        status: "open",
        priority: "normal",
        channel: "webchat",
        subject: ticketSubject.substring(0, 200), // Limit subject length
      })
      .select("id")
      .single();

    if (ticketError) {
      console.error("Failed to create helpdesk ticket:", ticketError);
      // Don't fail the handoff if ticket creation fails - continue with email notification
    } else if (ticket) {
      // Link ticket to conversation
      await supabase
        .from("conversations")
        .update({ helpdesk_ticket_id: ticket.id })
        .eq("id", id);
    }

    // Add system message about handoff
    const systemMessage = withinHours
      ? "You've been connected to our team. A human agent will respond shortly. Thank you for your patience!"
      : "Thanks for reaching out! Our team is currently offline. We've saved your information and will get back to you during our next business hours.";

    // Note: Using 'ai' sender_type with 'System' name since 'system' may not be in the enum
    // The inbox page handles system messages by checking sender_type or sender_name
    await supabase.from("messages").insert({
      conversation_id: id,
      sender_type: "ai",
      sender_name: "System",
      content: systemMessage,
    });

    // Get recent messages for context (optional summary)
    const { data: recentMessages } = await supabase
      .from("messages")
      .select("sender_type, content")
      .eq("conversation_id", id)
      .order("created_at", { ascending: false })
      .limit(5);

    // Build conversation summary from recent messages
    const conversationSummary = recentMessages
      ?.reverse()
      .map((m) => {
        const sender = m.sender_type === "visitor" ? "Visitor" : "Bot";
        return `${sender}: ${m.content.substring(0, 100)}${m.content.length > 100 ? "..." : ""}`;
      })
      .join("\n") || "";

    // Send handoff notification email (non-blocking)
    sendHandoffRequestEmail({
      visitorName: visitorName || conversation.visitor_name,
      visitorEmail: visitorEmail || conversation.visitor_email,
      reason: reason || message || "Human handoff requested",
      conversationId: id,
      conversationSummary,
    }).catch((err) => console.error("Failed to send handoff email:", err));

    // Also trigger the existing notification endpoint (for logging)
    try {
      await fetch(`${request.nextUrl.origin}/api/notifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "handoff_requested",
          conversationId: id,
          visitorName: visitorName || conversation.visitor_name,
          visitorEmail: visitorEmail || conversation.visitor_email,
          message: message || "Human handoff requested",
        }),
      });
    } catch (notifyError) {
      console.error("Failed to send notification:", notifyError);
    }

    // Track Klaviyo handoff event (non-blocking)
    const emailForKlaviyo = visitorEmail || conversation.visitor_email;
    if (emailForKlaviyo) {
      trackChatEvent(
        "handoff_requested",
        {
          email: emailForKlaviyo,
          firstName: visitorName || conversation.visitor_name,
        },
        id,
        {
          reason: reason || message,
          within_operating_hours: withinHours,
        }
      ).catch((err) => console.error("Klaviyo handoff tracking error:", err));
    }

    return NextResponse.json(
      {
        success: true,
        withinOperatingHours: withinHours,
        message: systemMessage,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("Handoff error:", error);
    return NextResponse.json(
      { error: "Failed to process handoff request" },
      { status: 500, headers: corsHeaders }
    );
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}
