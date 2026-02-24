import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * PUT /api/outreach/signatures/[id]
 * Update a signature
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabase();
    const body = await req.json();
    const { name, signature_html, signature_json } = body;

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updateData.name = name.trim();
    if (signature_html !== undefined) updateData.signature_html = signature_html;
    if (signature_json !== undefined) updateData.signature_json = signature_json;

    const { data, error } = await supabase
      .from("outreach_signatures")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Signature update error:", error);
    return NextResponse.json({ error: "Failed to update signature" }, { status: 500 });
  }
}

/**
 * DELETE /api/outreach/signatures/[id]
 * Delete a signature (blocked if in use)
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabase();

    // Check if set as default in settings
    const { data: settings } = await supabase
      .from("outreach_settings")
      .select("default_signature_id, automation_signature_id")
      .limit(1)
      .single();

    if (settings?.default_signature_id === id) {
      return NextResponse.json(
        { error: "Cannot delete: this signature is set as the campaign default" },
        { status: 400 }
      );
    }
    if (settings?.automation_signature_id === id) {
      return NextResponse.json(
        { error: "Cannot delete: this signature is set as the automation default" },
        { status: 400 }
      );
    }

    // Check if referenced by campaigns
    const { count } = await supabase
      .from("outreach_campaigns")
      .select("id", { count: "exact", head: true })
      .eq("signature_id", id);

    if (count && count > 0) {
      return NextResponse.json(
        { error: `Cannot delete: ${count} campaign(s) use this signature` },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("outreach_signatures")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Signature delete error:", error);
    return NextResponse.json({ error: "Failed to delete signature" }, { status: 500 });
  }
}
