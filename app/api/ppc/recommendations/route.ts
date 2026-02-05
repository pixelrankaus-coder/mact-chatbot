import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// GET: Get active recommendations
export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);

    const limit = parseInt(searchParams.get("limit") || "5");
    const includeExpired = searchParams.get("include_expired") === "true";
    const includeDismissed = searchParams.get("include_dismissed") === "true";

    // Get active connection
    const { data: connection } = await supabase
      .from("ppc_connections")
      .select("id")
      .eq("is_active", true)
      .single();

    if (!connection) {
      return NextResponse.json({
        recommendations: [],
        message: "No active PPC connection",
      });
    }

    // Build query
    let query = supabase
      .from("ppc_recommendations")
      .select("*")
      .eq("connection_id", connection.id)
      .eq("is_actioned", false)
      .order("priority", { ascending: true }) // high comes before low alphabetically
      .order("created_at", { ascending: false })
      .limit(limit);

    if (!includeDismissed) {
      query = query.eq("is_dismissed", false);
    }

    if (!includeExpired) {
      query = query.or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching recommendations:", error);
      return NextResponse.json({ error: "Failed to fetch recommendations" }, { status: 500 });
    }

    return NextResponse.json({
      recommendations: data || [],
      count: data?.length || 0,
    });
  } catch (error) {
    console.error("PPC recommendations error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: Create a new recommendation (typically called by AI or cron job)
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const body = await req.json();

    const {
      connection_id,
      recommendation_type,
      priority,
      title,
      insight,
      recommendation,
      expected_impact,
      confidence,
      data_points,
      expires_in_days,
    } = body;

    if (!connection_id || !recommendation_type || !title) {
      return NextResponse.json(
        { error: "Missing required fields: connection_id, recommendation_type, title" },
        { status: 400 }
      );
    }

    // Calculate expiry date
    const expiresAt = expires_in_days
      ? new Date(Date.now() + expires_in_days * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const { data, error } = await supabase
      .from("ppc_recommendations")
      .insert({
        connection_id,
        recommendation_type,
        priority: priority || "medium",
        title,
        insight,
        recommendation,
        expected_impact,
        confidence: confidence || "medium",
        data_points,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating recommendation:", error);
      return NextResponse.json({ error: "Failed to create recommendation" }, { status: 500 });
    }

    return NextResponse.json({ recommendation: data });
  } catch (error) {
    console.error("PPC recommendation create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH: Update recommendation (dismiss or action)
export async function PATCH(req: Request) {
  try {
    const supabase = await createClient();
    const body = await req.json();

    const { id, action } = body;

    if (!id || !action) {
      return NextResponse.json(
        { error: "Missing required fields: id, action" },
        { status: 400 }
      );
    }

    let updateData: Record<string, any> = {};

    switch (action) {
      case "dismiss":
        updateData = { is_dismissed: true };
        break;
      case "action":
        updateData = { is_actioned: true, actioned_at: new Date().toISOString() };
        break;
      case "restore":
        updateData = { is_dismissed: false };
        break;
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("ppc_recommendations")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating recommendation:", error);
      return NextResponse.json({ error: "Failed to update recommendation" }, { status: 500 });
    }

    return NextResponse.json({ recommendation: data });
  } catch (error) {
    console.error("PPC recommendation update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
