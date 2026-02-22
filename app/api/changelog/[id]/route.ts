import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// PATCH /api/changelog/[id] - Update a changelog entry
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();
    const body = await request.json();

    const updates: Record<string, unknown> = {};
    if (body.version !== undefined) updates.version = body.version.trim();
    if (body.date !== undefined) updates.date = body.date;
    if (body.type !== undefined) updates.type = body.type;
    if (body.category !== undefined) updates.category = body.category;
    if (body.title !== undefined) updates.title = body.title.trim();
    if (body.description !== undefined) updates.description = body.description.trim();
    if (body.details !== undefined) updates.details = body.details;
    updates.updated_at = new Date().toISOString();

    const { data: entry, error } = await supabase
      .from("changelog_entries")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating changelog entry:", error);
      return NextResponse.json(
        { error: "Failed to update entry" },
        { status: 500 }
      );
    }

    return NextResponse.json({ entry });
  } catch (error) {
    console.error("Update changelog error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/changelog/[id] - Delete a changelog entry
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();

    const { error } = await supabase
      .from("changelog_entries")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting changelog entry:", error);
      return NextResponse.json(
        { error: "Failed to delete entry" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete changelog error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
