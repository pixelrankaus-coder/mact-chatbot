import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { trackChatEvent, upsertProfile, subscribeToList } from "@/lib/klaviyo";
import { logInfo, logError } from "@/lib/logger";

// Create supabase client at runtime for server-side usage
function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

// Get client IP from request headers
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIP = request.headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }
  return "unknown";
}

// Get location from IP using free ipapi.co service
async function getLocationFromIP(ip: string): Promise<string | null> {
  if (ip === "unknown" || ip === "127.0.0.1" || ip.startsWith("192.168.") || ip.startsWith("10.")) {
    return null;
  }
  try {
    const response = await fetch(`https://ipapi.co/${ip}/json/`, {
      headers: { "User-Agent": "MACt-Chatbot/1.0" },
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (data.error) return null;
    const parts = [data.city, data.region, data.country_name].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : null;
  } catch {
    return null;
  }
}

// CORS headers for widget
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// POST /api/widget/conversations - Create a new conversation
export async function POST(request: NextRequest) {
  try {
    // Check env vars are available
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error("Missing Supabase env vars:", { supabaseUrl: !!supabaseUrl, supabaseKey: !!supabaseKey });
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500, headers: corsHeaders }
      );
    }

    const supabase = getSupabase();
    const body = await request.json();
    const { visitorId, visitorName, visitorEmail, visitorInfo, prechatData } = body;

    if (!visitorId) {
      return NextResponse.json(
        { error: "visitorId is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Get client IP and location
    const clientIP = getClientIP(request);
    const location = await getLocationFromIP(clientIP);

    // Build metadata object from widget's visitorInfo + server-side data
    const metadata = {
      ...(visitorInfo || {}),
      ip: clientIP,
      serverTimestamp: new Date().toISOString(),
    };

    // Check if there's an existing open conversation for this visitor
    const { data: existing, error: existingError } = await supabase
      .from("conversations")
      .select("*")
      .eq("visitor_id", visitorId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (existing && !existingError) {
      // Update existing conversation with latest visitor info
      await supabase
        .from("conversations")
        .update({
          metadata: metadata,
          visitor_location: location,
        })
        .eq("id", existing.id);

      // Return existing conversation
      return NextResponse.json(
        { conversation: existing, isExisting: true },
        { headers: corsHeaders }
      );
    }

    // Create new conversation with visitor info
    const { data: conversation, error: insertError } = await supabase
      .from("conversations")
      .insert({
        visitor_id: visitorId,
        visitor_name: visitorName || prechatData?.name || "Website Visitor",
        visitor_email: visitorEmail || prechatData?.email || null,
        visitor_location: location,
        metadata: metadata,
        prechat_data: prechatData || {},
        status: "active",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Supabase insert error:", JSON.stringify(insertError));
      return NextResponse.json(
        { error: "Database insert failed", details: insertError.message, code: insertError.code },
        { status: 500, headers: corsHeaders }
      );
    }

    if (!conversation) {
      return NextResponse.json(
        { error: "No conversation returned after insert" },
        { status: 500, headers: corsHeaders }
      );
    }

    // Add welcome message from AI
    const { data: aiSettings } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "ai_agent")
      .single();

    const welcomeMessage = aiSettings?.value?.welcomeMessage ||
      "Hi there! How can I help you today?";

    // Insert welcome message
    await supabase.from("messages").insert({
      conversation_id: conversation.id,
      sender_type: "ai",
      sender_name: aiSettings?.value?.name || "MACt Assistant",
      content: welcomeMessage,
    });

    // Track Klaviyo event (non-blocking)
    const visitorEmailForKlaviyo = visitorEmail || prechatData?.email;
    if (visitorEmailForKlaviyo) {
      // Track chat started event
      trackChatEvent(
        "chat_started",
        {
          email: visitorEmailForKlaviyo,
          firstName: visitorName || prechatData?.name,
          properties: {
            visitor_id: visitorId,
            location: location,
          },
        },
        conversation.id
      ).catch((err) => console.error("Klaviyo tracking error:", err));

      // Upsert profile and subscribe to list
      upsertProfile({
        email: visitorEmailForKlaviyo,
        firstName: visitorName || prechatData?.name,
        properties: {
          chat_visitor: true,
          last_chat_date: new Date().toISOString(),
        },
      }).catch((err) => console.error("Klaviyo profile error:", err));

      subscribeToList(visitorEmailForKlaviyo).catch((err) =>
        console.error("Klaviyo subscribe error:", err)
      );

      // If pre-chat form was submitted, track that too
      if (prechatData && Object.keys(prechatData).length > 0) {
        trackChatEvent(
          "pre_chat_form_submitted",
          {
            email: visitorEmailForKlaviyo,
            firstName: prechatData.name,
            phone: prechatData.phone,
          },
          conversation.id,
          { form_data: prechatData }
        ).catch((err) => console.error("Klaviyo pre-chat tracking error:", err));
      }
    }

    logInfo("widget", `New chat started from ${location || "unknown location"} (${visitorName || "anonymous"})`, {
      path: "/api/widget/conversations",
      method: "POST",
      status_code: 201,
      metadata: {
        conversationId: conversation.id,
        visitorName: visitorName || prechatData?.name,
        visitorEmail: visitorEmail || prechatData?.email,
        location,
        ip: clientIP,
      },
    });

    return NextResponse.json(
      { conversation, isExisting: false },
      { status: 201, headers: corsHeaders }
    );
  } catch (error: unknown) {
    let errorMessage = "Unknown error";
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === "object" && error !== null) {
      errorMessage = JSON.stringify(error);
    } else {
      errorMessage = String(error);
    }
    console.error("Failed to create conversation:", errorMessage);
    logError("widget", `Widget conversation creation failed: ${errorMessage}`, {
      path: "/api/widget/conversations", method: "POST", status_code: 500,
      metadata: { error: errorMessage },
    });
    return NextResponse.json(
      { error: "Failed to create conversation", details: errorMessage },
      { status: 500, headers: corsHeaders }
    );
  }
}

// GET /api/widget/conversations?visitorId=xxx - Get visitor's conversations
export async function GET(request: NextRequest) {
  const supabase = getSupabase();

  try {
    const { searchParams } = new URL(request.url);
    const visitorId = searchParams.get("visitorId");

    if (!visitorId) {
      return NextResponse.json(
        { error: "visitorId is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const { data: conversations, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("visitor_id", visitorId)
      .order("updated_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json(
      { conversations },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("Failed to fetch conversations:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500, headers: corsHeaders }
    );
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}
