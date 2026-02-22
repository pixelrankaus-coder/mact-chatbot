import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// GET /api/feature-requests - List all feature requests
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // "new" | "planned" | "in_progress" | "completed" | "rejected"

    let query = supabase
      .from("feature_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    const { data: requests, error } = await query;

    if (error) {
      if (error.code === "42P01") {
        return NextResponse.json({ requests: [], count: 0 });
      }
      console.error("Error fetching feature requests:", error);
      return NextResponse.json(
        { error: "Failed to fetch feature requests" },
        { status: 500 }
      );
    }

    return NextResponse.json({ requests: requests || [], count: requests?.length || 0 });
  } catch (error) {
    console.error("Feature requests API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/feature-requests - Create a new feature request
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { title, description, category, priority, submitted_by } = body;

    if (!title) {
      return NextResponse.json(
        { error: "title is required" },
        { status: 400 }
      );
    }

    const { data: featureRequest, error } = await supabase
      .from("feature_requests")
      .insert({
        title: title.trim(),
        description: (description || "").trim(),
        category: category || "feature",
        priority: priority || "normal",
        submitted_by: (submitted_by || "").trim(),
        status: "new",
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating feature request:", error);
      return NextResponse.json(
        { error: "Failed to create feature request" },
        { status: 500 }
      );
    }

    return NextResponse.json({ request: featureRequest }, { status: 201 });
  } catch (error) {
    console.error("Create feature request error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
