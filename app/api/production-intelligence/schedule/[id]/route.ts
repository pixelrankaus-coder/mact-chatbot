import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

/**
 * PATCH /api/production-intelligence/schedule/[id]
 * Update a scheduled run (confirm, complete, add notes, etc.)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const supabase = createServiceClient();

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.status !== undefined) updates.status = body.status;
    if (body.confirmed_qty !== undefined) updates.confirmed_qty = body.confirmed_qty;
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.confirmed_by !== undefined) updates.confirmed_by = body.confirmed_by;
    if (body.sequence_order !== undefined) updates.sequence_order = body.sequence_order;

    if (body.status === "complete") {
      updates.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("pi_production_schedule")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ run: data });
  } catch (error) {
    console.error("[Schedule] Update error:", error);
    return NextResponse.json(
      { error: "Failed to update run" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/production-intelligence/schedule/[id]
 * Cancel a scheduled run
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();

    const { error } = await supabase
      .from("pi_production_schedule")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Schedule] Delete error:", error);
    return NextResponse.json(
      { error: "Failed to cancel run" },
      { status: 500 }
    );
  }
}
