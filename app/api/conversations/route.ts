import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// GET /api/conversations - List conversations for inbox
export async function GET(request: NextRequest) {
  const supabase = createServiceClient();

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // "active", "pending", "resolved", or null for all
    const excludeResolved = searchParams.get("excludeResolved") === "true";

    let query = supabase
      .from("conversations")
      .select("*")
      .order("updated_at", { ascending: false });

    if (status && status !== "all") {
      query = query.eq("status", status);
    } else if (excludeResolved) {
      query = query.in("status", ["active", "pending"]);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ conversations: data || [] });
  } catch (error) {
    console.error("Failed to fetch conversations:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 }
    );
  }
}

// PATCH /api/conversations - Update conversation status or assignment
export async function PATCH(request: NextRequest) {
  const supabase = createServiceClient();

  try {
    const body = await request.json();
    const { id, status, assigned_to } = body;

    if (!id) {
      return NextResponse.json({ error: "Conversation ID required" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (status !== undefined) {
      updateData.status = status;
      if (status === "resolved") {
        updateData.resolved_at = new Date().toISOString();
      } else {
        updateData.resolved_at = null;
      }
    }
    if (assigned_to !== undefined) {
      updateData.assigned_to = assigned_to;
    }

    const { data, error } = await supabase
      .from("conversations")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ conversation: data });
  } catch (error) {
    console.error("Failed to update conversation:", error);
    return NextResponse.json(
      { error: "Failed to update conversation" },
      { status: 500 }
    );
  }
}
