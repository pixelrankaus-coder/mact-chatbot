import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// PATCH /api/feature-requests/[id] - Update a feature request
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();
    const body = await request.json();

    const updates: Record<string, unknown> = {};
    if (body.title !== undefined) updates.title = body.title.trim();
    if (body.description !== undefined) updates.description = body.description.trim();
    if (body.category !== undefined) updates.category = body.category;
    if (body.status !== undefined) updates.status = body.status;
    if (body.priority !== undefined) updates.priority = body.priority;
    if (body.admin_notes !== undefined) updates.admin_notes = body.admin_notes.trim();
    updates.updated_at = new Date().toISOString();

    const { data: featureRequest, error } = await supabase
      .from("feature_requests")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating feature request:", error);
      return NextResponse.json(
        { error: "Failed to update feature request" },
        { status: 500 }
      );
    }

    return NextResponse.json({ request: featureRequest });
  } catch (error) {
    console.error("Update feature request error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/feature-requests/[id] - Delete a feature request
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();

    const { error } = await supabase
      .from("feature_requests")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting feature request:", error);
      return NextResponse.json(
        { error: "Failed to delete feature request" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete feature request error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
