import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// GET /api/changelog - List all changelog entries
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category"); // "admin" | "widget" | null (all)
    const since = searchParams.get("since"); // ISO timestamp - for "What's New" badge

    let query = supabase
      .from("changelog_entries")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (category) {
      query = query.eq("category", category);
    }

    if (since) {
      query = query.gt("created_at", since);
    }

    const { data: entries, error } = await query;

    if (error) {
      // Table might not exist yet
      if (error.code === "42P01") {
        return NextResponse.json({ entries: [], count: 0 });
      }
      console.error("Error fetching changelog:", error);
      return NextResponse.json(
        { error: "Failed to fetch changelog" },
        { status: 500 }
      );
    }

    return NextResponse.json({ entries: entries || [], count: entries?.length || 0 });
  } catch (error) {
    console.error("Changelog API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/changelog - Create a new changelog entry
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { version, date, type, category, title, description, details } = body;

    if (!version || !title || !description) {
      return NextResponse.json(
        { error: "version, title, and description are required" },
        { status: 400 }
      );
    }

    const { data: entry, error } = await supabase
      .from("changelog_entries")
      .insert({
        version: version.trim(),
        date: date || new Date().toISOString().slice(0, 10),
        type: type || "feature",
        category: category || "admin",
        title: title.trim(),
        description: description.trim(),
        details: details || [],
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating changelog entry:", error);
      return NextResponse.json(
        { error: "Failed to create entry" },
        { status: 500 }
      );
    }

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    console.error("Create changelog error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
