import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * GET /api/outreach/signatures
 * List all signatures + which are set as defaults
 */
export async function GET() {
  try {
    const supabase = getSupabase();

    const { data: signatures, error } = await supabase
      .from("outreach_signatures")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get default assignments from settings
    const { data: settings } = await supabase
      .from("outreach_settings")
      .select("default_signature_id, automation_signature_id")
      .limit(1)
      .single();

    return NextResponse.json({
      signatures: signatures || [],
      default_signature_id: settings?.default_signature_id || null,
      automation_signature_id: settings?.automation_signature_id || null,
    });
  } catch (error) {
    console.error("Signatures list error:", error);
    return NextResponse.json({ error: "Failed to fetch signatures" }, { status: 500 });
  }
}

/**
 * POST /api/outreach/signatures
 * Create a new signature
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await req.json();
    const { name, signature_html, signature_json } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("outreach_signatures")
      .insert({
        name: name.trim(),
        signature_html: signature_html || "",
        signature_json: signature_json || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Signature create error:", error);
    return NextResponse.json({ error: "Failed to create signature" }, { status: 500 });
  }
}
