import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

// GET /api/outreach/settings - Fetch outreach settings
export async function GET() {
  try {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from("outreach_settings")
      .select("*")
      .limit(1)
      .single();

    if (error) {
      console.error("Error fetching settings:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/outreach/settings - Update outreach settings
export async function PATCH(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await request.json();

    // Get current settings ID
    const { data: current } = await supabase
      .from("outreach_settings")
      .select("id")
      .limit(1)
      .single();

    if (!current) {
      return NextResponse.json({ error: "Settings not found" }, { status: 404 });
    }

    // Update settings
    const { data, error } = await supabase
      .from("outreach_settings")
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq("id", current.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating settings:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
