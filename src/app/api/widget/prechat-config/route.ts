import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

// CORS headers for widget
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function GET() {
  const supabase = getSupabase();

  try {
    const { data, error } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "prechat_form")
      .single();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    // If no config or not enabled, return disabled state
    if (!data?.value || !data.value.enabled) {
      return NextResponse.json({ enabled: false }, { headers: corsHeaders });
    }

    // Return the config for the widget
    return NextResponse.json(
      {
        enabled: true,
        title: data.value.title,
        subtitle: data.value.subtitle,
        fields: data.value.fields,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("Failed to fetch prechat config for widget:", error);
    return NextResponse.json({ enabled: false }, { headers: corsHeaders });
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}
