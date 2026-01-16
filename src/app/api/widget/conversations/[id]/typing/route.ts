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
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// POST /api/widget/conversations/[id]/typing - Update typing status
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabase();
    const { isTyping, sender } = await request.json();

    // Validate sender
    if (sender !== "visitor" && sender !== "agent") {
      return NextResponse.json(
        { error: "Invalid sender type" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Determine which fields to update
    const field = sender === "visitor" ? "is_visitor_typing" : "is_agent_typing";
    const timeField = sender === "visitor" ? "visitor_typing_at" : "agent_typing_at";

    // Upsert typing status
    const { error } = await supabase
      .from("typing_status")
      .upsert({
        conversation_id: id,
        [field]: isTyping,
        [timeField]: isTyping ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "conversation_id"
      });

    if (error) {
      console.error("Failed to update typing status:", error);
      return NextResponse.json(
        { error: "Failed to update typing status" },
        { status: 500, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      { success: true },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("Typing status error:", error);
    return NextResponse.json(
      { error: "Failed to update typing status" },
      { status: 500, headers: corsHeaders }
    );
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}
