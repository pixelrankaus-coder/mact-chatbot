import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

// GET /api/helpdesk/macros/[id] - Get single macro
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabase();

    const { data: macro, error } = await supabase
      .from("helpdesk_macros")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !macro) {
      return NextResponse.json(
        { error: "Macro not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(macro);
  } catch (error) {
    console.error("Get macro error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/helpdesk/macros/[id] - Update macro
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabase();
    const updates = await request.json();

    const { data: macro, error } = await supabase
      .from("helpdesk_macros")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Failed to update macro:", error);
      return NextResponse.json(
        { error: "Failed to update macro" },
        { status: 500 }
      );
    }

    return NextResponse.json(macro);
  } catch (error) {
    console.error("Update macro error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/helpdesk/macros/[id] - Delete macro
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabase();

    const { error } = await supabase
      .from("helpdesk_macros")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Failed to delete macro:", error);
      return NextResponse.json(
        { error: "Failed to delete macro" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete macro error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/helpdesk/macros/[id]/use - Increment usage count
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabase();

    // Increment usage count
    const { data: macro, error } = await supabase.rpc("increment_macro_usage", {
      macro_id: id,
    });

    if (error) {
      // Fallback: manual update
      const { data: current } = await supabase
        .from("helpdesk_macros")
        .select("usage_count")
        .eq("id", id)
        .single();

      if (current) {
        await supabase
          .from("helpdesk_macros")
          .update({ usage_count: (current.usage_count || 0) + 1 })
          .eq("id", id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Increment macro usage error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
