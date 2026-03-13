import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

/**
 * GET /api/production-intelligence/rules
 * Returns all scheduling rules
 */
export async function GET() {
  try {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("pi_scheduling_rules")
      .select("*")
      .order("rule_type", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ rules: data || [] });
  } catch (error) {
    console.error("[Rules] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch rules" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/production-intelligence/rules
 * Create a new scheduling rule
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("pi_scheduling_rules")
      .insert({
        rule_type: body.rule_type,
        sku_id: body.sku_id || null,
        value_text: body.value_text || null,
        value_numeric: body.value_numeric ?? null,
        value_boolean: body.value_boolean ?? null,
        description: body.description || null,
        is_active: body.is_active ?? true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ rule: data });
  } catch (error) {
    console.error("[Rules] Create error:", error);
    return NextResponse.json(
      { error: "Failed to create rule" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/production-intelligence/rules
 * Update a scheduling rule (requires id in body)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = createServiceClient();

    if (!body.id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.value_text !== undefined) updates.value_text = body.value_text;
    if (body.value_numeric !== undefined) updates.value_numeric = body.value_numeric;
    if (body.value_boolean !== undefined) updates.value_boolean = body.value_boolean;
    if (body.description !== undefined) updates.description = body.description;
    if (body.is_active !== undefined) updates.is_active = body.is_active;

    const { data, error } = await supabase
      .from("pi_scheduling_rules")
      .update(updates)
      .eq("id", body.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ rule: data });
  } catch (error) {
    console.error("[Rules] Update error:", error);
    return NextResponse.json(
      { error: "Failed to update rule" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/production-intelligence/rules
 * Delete a scheduling rule (requires id in body)
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = createServiceClient();

    if (!body.id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("pi_scheduling_rules")
      .delete()
      .eq("id", body.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Rules] Delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete rule" },
      { status: 500 }
    );
  }
}
