import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

// GET /api/helpdesk/tags - List all tags
export async function GET() {
  try {
    const supabase = getSupabase();

    const { data: tags, error } = await supabase
      .from("helpdesk_tags")
      .select("*")
      .order("name");

    if (error) {
      console.error("Failed to fetch tags:", error);
      return NextResponse.json(
        { error: "Failed to fetch tags" },
        { status: 500 }
      );
    }

    return NextResponse.json(tags || []);
  } catch (error) {
    console.error("Tags list error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/helpdesk/tags - Create a new tag
export async function POST(request: Request) {
  try {
    const supabase = getSupabase();
    const body = await request.json();

    const { name, color = "#6B7280", description } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    const { data: tag, error } = await supabase
      .from("helpdesk_tags")
      .insert({ name, color, description })
      .select()
      .single();

    if (error) {
      console.error("Failed to create tag:", error);
      return NextResponse.json(
        { error: "Failed to create tag" },
        { status: 500 }
      );
    }

    return NextResponse.json(tag, { status: 201 });
  } catch (error) {
    console.error("Create tag error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
