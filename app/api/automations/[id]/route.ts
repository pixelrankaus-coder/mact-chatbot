import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any;

/**
 * PATCH /api/automations/[id]
 * Update automation status (pause, resume, cancel)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient() as SupabaseAny;
    const body = await req.json();
    const { action } = body;

    const now = new Date().toISOString();

    let updateData: Record<string, unknown> = { updated_at: now };

    switch (action) {
      case "pause":
        updateData = { ...updateData, status: "paused", paused_at: now, paused_by: "admin" };
        break;
      case "resume":
        updateData = { ...updateData, status: "active", paused_at: null, paused_by: null };
        break;
      case "cancel":
        updateData = { ...updateData, status: "cancelled", completed_reason: "manual_cancel" };
        break;
      default:
        return NextResponse.json({ error: "Invalid action. Use: pause, resume, cancel" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("order_automations")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ automation: data });
  } catch (error) {
    console.error("Automation update error:", error);
    return NextResponse.json({ error: "Failed to update automation" }, { status: 500 });
  }
}

/**
 * GET /api/automations/[id]
 * Get single automation with related campaign history
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient() as SupabaseAny;

    const { data: automation, error } = await supabase
      .from("order_automations")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !automation) {
      return NextResponse.json({ error: "Automation not found" }, { status: 404 });
    }

    // Fetch related campaigns (sent as part of this automation)
    const { data: campaigns } = await supabase
      .from("outreach_campaigns")
      .select("id, name, status, sent_count, opened_count, clicked_count, created_at")
      .ilike("name", `%${automation.order_number}%`)
      .order("created_at", { ascending: false })
      .limit(20);

    return NextResponse.json({
      automation,
      campaigns: campaigns || [],
    });
  } catch (error) {
    console.error("Automation detail error:", error);
    return NextResponse.json({ error: "Failed to fetch automation" }, { status: 500 });
  }
}
