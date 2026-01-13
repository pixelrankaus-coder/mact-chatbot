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
    const { visitorId, visitorName, visitorEmail } = body;

    if (!visitorId) {
      return NextResponse.json(
        { error: "visitorId is required" },
        { status: 400, headers: corsHeaders }
      );
    }

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
      // Return existing conversation
      return NextResponse.json(
        { conversation: existing, isExisting: true },
        { headers: corsHeaders }
      );
    }

    // Create new conversation - only use columns that definitely exist in DB
    const { data: conversation, error: insertError } = await supabase
      .from("conversations")
      .insert({
        visitor_id: visitorId,
        visitor_name: visitorName || "Website Visitor",
        visitor_email: visitorEmail || null,
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
