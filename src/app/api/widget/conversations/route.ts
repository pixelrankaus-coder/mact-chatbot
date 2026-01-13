import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Create supabase client at runtime for server-side usage
function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

// CORS headers for widget
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Helper to get IP from request
function getClientIP(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  const realIP = request.headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }
  return "Unknown";
}

// Helper to get location from IP using free API
async function getLocationFromIP(ip: string): Promise<{ city?: string; region?: string; country?: string } | null> {
  if (ip === "Unknown" || ip === "127.0.0.1" || ip.startsWith("192.168.") || ip.startsWith("10.")) {
    return null;
  }
  try {
    const response = await fetch(`https://ipapi.co/${ip}/json/`, {
      headers: { "User-Agent": "MACt-Chatbot/1.0" },
    });
    if (!response.ok) return null;
    const data = await response.json();
    return {
      city: data.city,
      region: data.region,
      country: data.country_name,
    };
  } catch {
    return null;
  }
}

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
    const { visitorId, visitorName, visitorEmail, visitorInfo } = body;

    if (!visitorId) {
      return NextResponse.json(
        { error: "visitorId is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Get visitor IP and location
    const clientIP = getClientIP(request);

    // Skip location lookup for now to simplify debugging
    let location = null;
    try {
      location = await getLocationFromIP(clientIP);
    } catch (locErr) {
      console.error("Location lookup failed:", locErr);
    }

    // Build metadata with visitor info
    const metadata = {
      ...visitorInfo,
      ip: clientIP,
      location: location
        ? `${location.city || ""}${location.city && location.region ? ", " : ""}${location.region || ""}${(location.city || location.region) && location.country ? ", " : ""}${location.country || ""}`
        : null,
      locationData: location,
      pagesViewed: visitorInfo?.currentPage ? [{ url: visitorInfo.currentPage, title: visitorInfo.pageTitle, visitedAt: visitorInfo.visitedAt }] : [],
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
      // Return existing conversation (skip metadata update since column doesn't exist)
      const updatedLocation = metadata.location || existing.visitor_location;
      if (updatedLocation !== existing.visitor_location) {
        await supabase
          .from("conversations")
          .update({ visitor_location: updatedLocation })
          .eq("id", existing.id);
      }

      return NextResponse.json(
        { conversation: { ...existing, visitor_location: updatedLocation }, isExisting: true },
        { headers: corsHeaders }
      );
    }

    // Create new conversation with visitor info
    // Note: metadata column may not exist in DB yet, so we store key info in visitor_location
    const locationString = metadata.location ||
      (visitorInfo?.browser && visitorInfo?.os ? `${visitorInfo.browser}, ${visitorInfo.os}` : null);

    const { data: conversation, error: insertError } = await supabase
      .from("conversations")
      .insert({
        visitor_id: visitorId,
        visitor_name: visitorName || "Website Visitor",
        visitor_email: visitorEmail || null,
        visitor_location: locationString,
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
