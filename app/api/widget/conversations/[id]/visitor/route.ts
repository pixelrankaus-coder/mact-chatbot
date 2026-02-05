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
  "Access-Control-Allow-Methods": "PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// PATCH /api/widget/conversations/[id]/visitor - Update visitor data
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabase();
    const visitorData = await request.json();

    // Get current conversation
    const { data: conversation, error: fetchError } = await supabase
      .from("conversations")
      .select("metadata")
      .eq("id", id)
      .single();

    if (fetchError) {
      console.error("Failed to fetch conversation:", fetchError);
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    // Merge visitor data into metadata
    const currentMetadata = conversation?.metadata || {};
    const updatedMetadata = {
      ...currentMetadata,
      pagesViewed: visitorData.pagesViewed || currentMetadata.pagesViewed,
      currentPage: visitorData.currentPage || currentMetadata.currentPage,
      pageTitle: visitorData.pageTitle || currentMetadata.pageTitle,
      lastActivity: new Date().toISOString(),
      // Email capture data
      ...(visitorData.visitorEmail && { visitorEmail: visitorData.visitorEmail }),
      ...(visitorData.newsletterOptIn !== undefined && { newsletterOptIn: visitorData.newsletterOptIn }),
    };

    // Build update object - include visitor_email at top level if provided
    const updateData: Record<string, unknown> = { metadata: updatedMetadata };
    if (visitorData.visitorEmail) {
      updateData.visitor_email = visitorData.visitorEmail;
    }

    // Update conversation
    const { error: updateError } = await supabase
      .from("conversations")
      .update(updateData)
      .eq("id", id);

    if (updateError) {
      console.error("Failed to update conversation:", updateError);
      return NextResponse.json(
        { error: "Failed to update visitor data" },
        { status: 500, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      { success: true },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("Update visitor error:", error);
    return NextResponse.json(
      { error: "Failed to update visitor data" },
      { status: 500, headers: corsHeaders }
    );
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}
