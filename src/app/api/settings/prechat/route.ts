import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

// Default prechat form configuration
const defaultConfig = {
  enabled: false,
  title: "Start a conversation",
  subtitle: "Please fill in your details to begin",
  fields: [
    { id: "name", type: "text", label: "Name", placeholder: "Your name", required: true },
    { id: "email", type: "email", label: "Email", placeholder: "your@email.com", required: true },
  ],
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
      // PGRST116 = no rows found
      throw error;
    }

    // Return stored config or defaults
    return NextResponse.json(data?.value || defaultConfig);
  } catch (error) {
    console.error("Failed to fetch prechat settings:", error);
    return NextResponse.json(defaultConfig);
  }
}

export async function POST(request: NextRequest) {
  const supabase = getSupabase();

  try {
    const body = await request.json();

    // Validate required fields
    if (typeof body.enabled !== "boolean") {
      return NextResponse.json(
        { error: "enabled field is required" },
        { status: 400 }
      );
    }

    const config = {
      enabled: body.enabled,
      title: body.title || defaultConfig.title,
      subtitle: body.subtitle || defaultConfig.subtitle,
      fields: body.fields || defaultConfig.fields,
    };

    // Upsert settings
    const { error } = await supabase
      .from("settings")
      .upsert(
        {
          key: "prechat_form",
          value: config,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      );

    if (error) throw error;

    return NextResponse.json({ success: true, config });
  } catch (error) {
    console.error("Failed to save prechat settings:", error);
    return NextResponse.json(
      { error: "Failed to save settings" },
      { status: 500 }
    );
  }
}
