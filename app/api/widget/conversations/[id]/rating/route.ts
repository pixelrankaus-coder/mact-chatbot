import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { trackChatEvent } from "@/lib/klaviyo";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any;

// CORS headers for widget
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params;

  try {
    const { rating, feedback } = await request.json();

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Rating must be 1-5" },
        { status: 400, headers: corsHeaders }
      );
    }

    const supabase = createServiceClient() as SupabaseAny;

    // Upsert rating
    const { error: ratingError } = await supabase
      .from("chat_ratings")
      .upsert(
        {
          conversation_id: conversationId,
          rating,
          feedback: feedback?.trim() || null,
        },
        { onConflict: "conversation_id" }
      );

    if (ratingError) {
      console.error("Rating upsert error:", ratingError);
      return NextResponse.json(
        { error: ratingError.message },
        { status: 500, headers: corsHeaders }
      );
    }

    // Update conversation for quick access
    await supabase
      .from("conversations")
      .update({
        rating,
        rating_feedback: feedback?.trim() || null,
      })
      .eq("id", conversationId);

    // Track Klaviyo rating event (non-blocking)
    // First, get visitor email from conversation
    const { data: conversation } = await supabase
      .from("conversations")
      .select("visitor_email, visitor_name")
      .eq("id", conversationId)
      .single();

    if (conversation?.visitor_email) {
      trackChatEvent(
        "chat_rated",
        {
          email: conversation.visitor_email,
          firstName: conversation.visitor_name,
        },
        conversationId,
        {
          rating,
          feedback: feedback?.trim() || null,
        }
      ).catch((err) => console.error("Klaviyo rating tracking error:", err));
    }

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    console.error("Rating API error:", error);
    return NextResponse.json(
      { error: "Failed to save rating" },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params;

  try {
    const supabase = createServiceClient() as SupabaseAny;

    const { data } = await supabase
      .from("chat_ratings")
      .select("*")
      .eq("conversation_id", conversationId)
      .single();

    return NextResponse.json(data || null, { headers: corsHeaders });
  } catch (error) {
    console.error("Rating GET error:", error);
    return NextResponse.json(null, { headers: corsHeaders });
  }
}
