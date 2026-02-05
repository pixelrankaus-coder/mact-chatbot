import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

// GET /api/helpdesk/macros - List all macros
export async function GET() {
  try {
    const supabase = getSupabase();

    const { data: macros, error } = await supabase
      .from("helpdesk_macros")
      .select("*")
      .order("category")
      .order("name");

    if (error) {
      console.error("Failed to fetch macros:", error);
      return NextResponse.json(
        { error: "Failed to fetch macros" },
        { status: 500 }
      );
    }

    return NextResponse.json(macros || []);
  } catch (error) {
    console.error("Macros list error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/helpdesk/macros - Create a new macro
export async function POST(request: Request) {
  try {
    const supabase = getSupabase();
    const body = await request.json();

    const { name, content, shortcut, category } = body;

    if (!name || !content) {
      return NextResponse.json(
        { error: "Name and content are required" },
        { status: 400 }
      );
    }

    const { data: macro, error } = await supabase
      .from("helpdesk_macros")
      .insert({
        name,
        content,
        shortcut: shortcut || null,
        category: category || null,
        is_active: true,
        usage_count: 0,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to create macro:", error);
      return NextResponse.json(
        { error: "Failed to create macro" },
        { status: 500 }
      );
    }

    return NextResponse.json(macro, { status: 201 });
  } catch (error) {
    console.error("Create macro error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
