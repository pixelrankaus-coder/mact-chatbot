import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// GET /api/settings?key=ai_agent - Fetch a setting by key
export async function GET(request: NextRequest) {
  const supabase = createServiceClient();

  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key) {
      return NextResponse.json({ error: "key parameter required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("settings")
      .select("value")
      .eq("key", key)
      .single();

    if (error) {
      // PGRST116 = no rows found — return null value (caller uses default)
      if (error.code === "PGRST116") {
        return NextResponse.json({ value: null });
      }
      throw error;
    }

    return NextResponse.json({ value: data.value });
  } catch (error) {
    console.error("Failed to fetch setting:", error);
    return NextResponse.json(
      { error: "Failed to fetch setting" },
      { status: 500 }
    );
  }
}

// PATCH /api/settings - Upsert a setting by key
export async function PATCH(request: NextRequest) {
  const supabase = createServiceClient();

  try {
    const body = await request.json();
    const { key, value } = body;

    if (!key) {
      return NextResponse.json({ error: "key is required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("settings")
      .upsert(
        { key, value, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update setting:", error);
    return NextResponse.json(
      { error: "Failed to update setting" },
      { status: 500 }
    );
  }
}
