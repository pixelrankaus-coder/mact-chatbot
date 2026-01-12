import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

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
  const supabase = createServiceClient();

  try {
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
    const location = await getLocationFromIP(clientIP);

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
      // Update existing conversation with new page view
      const existingMetadata = (existing.metadata || {}) as Record<string, unknown>;
      const existingPages = (existingMetadata.pagesViewed || []) as Array<{ url: string; title: string; visitedAt: string }>;

      // Add current page if different from last viewed
      if (visitorInfo?.currentPage) {
        const lastPage = existingPages[existingPages.length - 1];
        if (!lastPage || lastPage.url !== visitorInfo.currentPage) {
          existingPages.push({
            url: visitorInfo.currentPage,
            title: visitorInfo.pageTitle,
            visitedAt: visitorInfo.visitedAt,
          });
        }
      }

      // Update metadata
      await supabase
        .from("conversations")
        .update({
          metadata: { ...existingMetadata, ...metadata, pagesViewed: existingPages },
          visitor_location: metadata.location || existing.visitor_location,
        })
        .eq("id", existing.id);

      // Return existing conversation with updated metadata
      return NextResponse.json(
        { conversation: { ...existing, metadata: { ...existingMetadata, ...metadata, pagesViewed: existingPages } }, isExisting: true },
        { headers: corsHeaders }
      );
    }

    // Create new conversation with visitor info
    const { data: conversation, error } = await supabase
      .from("conversations")
      .insert({
        visitor_id: visitorId,
        visitor_name: visitorName || "Website Visitor",
        visitor_email: visitorEmail || null,
        visitor_location: metadata.location,
        metadata,
        status: "active",
      })
      .select()
      .single();

    if (error) throw error;

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
  } catch (error) {
    console.error("Failed to create conversation:", error);
    return NextResponse.json(
      { error: "Failed to create conversation" },
      { status: 500, headers: corsHeaders }
    );
  }
}

// GET /api/widget/conversations?visitorId=xxx - Get visitor's conversations
export async function GET(request: NextRequest) {
  const supabase = createServiceClient();

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
