import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

// Default settings values
const DEFAULT_SETTINGS = {
  vip_min_orders: 5,
  vip_min_spend: 5000,
  dormant_months: 12,
  active_min_orders: 2,
  active_months: 6,
  new_days: 30,
};

// GET /api/settings/customer-segments - Fetch customer segment settings
export async function GET() {
  try {
    const supabase = getSupabase();

    // Try to get existing settings
    const { data, error } = await supabase
      .from("customer_segment_settings")
      .select("*")
      .limit(1)
      .single();

    if (error && error.code === "PGRST116") {
      // No rows found - return defaults (will be created on first save)
      return NextResponse.json(DEFAULT_SETTINGS);
    }

    if (error) {
      console.error("Error fetching customer segment settings:", error);
      // Return defaults on error
      return NextResponse.json(DEFAULT_SETTINGS);
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(DEFAULT_SETTINGS);
  }
}

// PUT /api/settings/customer-segments - Update or create settings (upsert)
export async function PUT(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await request.json();

    // Get current settings ID (if exists)
    const { data: current } = await supabase
      .from("customer_segment_settings")
      .select("id")
      .limit(1)
      .single();

    if (current?.id) {
      // Update existing settings
      const { data, error } = await supabase
        .from("customer_segment_settings")
        .update({
          ...body,
          updated_at: new Date().toISOString(),
        })
        .eq("id", current.id)
        .select()
        .single();

      if (error) {
        console.error("Error updating customer segment settings:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data);
    } else {
      // Create new settings
      const { data, error } = await supabase
        .from("customer_segment_settings")
        .insert({
          ...DEFAULT_SETTINGS,
          ...body,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating customer segment settings:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data);
    }
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
