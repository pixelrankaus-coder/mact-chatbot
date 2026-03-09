import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAllSegmentsWithCounts } from "@/lib/outreach/segment-engine";

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

// GET /api/outreach/segments - List all segments with counts
export async function GET() {
  try {
    const segments = await getAllSegmentsWithCounts();

    // Also include the legacy "custom" segment for backward compat
    const allSegments = [
      ...segments.map((s) => ({
        id: s.slug, // Use slug as ID for backward compat with campaign creation
        db_id: s.id,
        name: s.name,
        description: s.description || "",
        type: s.type,
        rules: s.rules,
        count: s.member_count,
        source: s.source,
        is_active: s.is_active,
        created_at: s.created_at,
      })),
      {
        id: "custom",
        db_id: null,
        name: "Custom / Test",
        description: "Enter email addresses manually",
        type: "custom",
        rules: [],
        count: 0,
        source: "all",
        is_active: true,
      },
    ];

    return NextResponse.json({ segments: allSegments });
  } catch (error) {
    console.error("Segments fetch error:", error);
    // Fallback: return minimal list
    return NextResponse.json({
      segments: [
        {
          id: "custom",
          name: "Custom / Test",
          description: "Enter email addresses manually",
          type: "custom",
          rules: [],
          count: 0,
        },
      ],
    });
  }
}

// POST /api/outreach/segments - Create a new segment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, type, rules, source } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    // Generate slug from name
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const supabase = getSupabase();

    const { data, error } = await supabase
      .from("segments")
      .insert({
        name,
        slug,
        description: description || null,
        type: type || "dynamic",
        rules: rules || [],
        source: source || "all",
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "A segment with this name already exists" },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({ segment: data }, { status: 201 });
  } catch (error) {
    console.error("Create segment error:", error);
    return NextResponse.json(
      { error: "Failed to create segment" },
      { status: 500 }
    );
  }
}
