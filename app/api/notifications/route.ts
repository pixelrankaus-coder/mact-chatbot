import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

/**
 * POST /api/notifications
 * Create a notification for new conversations needing human attention
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, conversationId, message, visitorName, visitorEmail } = body;

    if (!type || !conversationId) {
      return NextResponse.json(
        { error: "type and conversationId are required" },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Log the notification (for now - email integration in next task)
    console.log("=== NEW NOTIFICATION ===");
    console.log(`Type: ${type}`);
    console.log(`Conversation ID: ${conversationId}`);
    console.log(`Visitor: ${visitorName || "Unknown"} (${visitorEmail || "no email"})`);
    console.log(`Message: ${message || "N/A"}`);
    console.log("========================");

    // Update conversation to pending status
    const { error: updateError } = await supabase
      .from("conversations")
      .update({
        status: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversationId);

    if (updateError) {
      console.error("Failed to update conversation status:", updateError);
    }

    // In the future, this would:
    // 1. Send email notification to agents
    // 2. Send push notification
    // 3. Create notification record in database
    // 4. Trigger real-time update to admin panel

    return NextResponse.json({
      success: true,
      message: "Notification created",
    });
  } catch (error) {
    console.error("Notification error:", error);
    return NextResponse.json(
      { error: "Failed to create notification" },
      { status: 500 }
    );
  }
}
