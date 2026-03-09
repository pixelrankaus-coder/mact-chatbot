import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

// GET /api/contacts - List contacts with search/filter
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";
    const source = url.searchParams.get("source") || "";
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    const supabase = getSupabase();

    let query = supabase
      .from("contacts")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(
        `email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%,company.ilike.%${search}%`
      );
    }
    if (source) {
      query = query.eq("source", source);
    }

    const { data, count, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      contacts: data || [],
      total: count || 0,
      page,
      limit,
    });
  } catch (error) {
    console.error("List contacts error:", error);
    return NextResponse.json(
      { error: "Failed to list contacts" },
      { status: 500 }
    );
  }
}

// POST /api/contacts - Create a single contact
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, first_name, last_name, company, phone, source, tags } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Check for existing contact
    const { data: existing } = await supabase
      .from("contacts")
      .select("id")
      .eq("email", email.toLowerCase().trim())
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "Contact with this email already exists" },
        { status: 409 }
      );
    }

    // Check if this email exists in Cin7 or Woo
    const { data: cin7Match } = await supabase
      .from("cin7_customers")
      .select("cin7_id")
      .ilike("email", email.toLowerCase().trim())
      .limit(1)
      .single();

    const { data: wooMatch } = await supabase
      .from("woo_customers")
      .select("woo_id")
      .ilike("email", email.toLowerCase().trim())
      .limit(1)
      .single();

    const { data, error } = await supabase
      .from("contacts")
      .insert({
        email: email.toLowerCase().trim(),
        first_name: first_name || null,
        last_name: last_name || null,
        company: company || null,
        phone: phone || null,
        source: source || "manual",
        tags: tags || [],
        cin7_customer_id: cin7Match?.cin7_id || null,
        woo_customer_id: wooMatch?.woo_id ? String(wooMatch.woo_id) : null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ contact: data }, { status: 201 });
  } catch (error) {
    console.error("Create contact error:", error);
    return NextResponse.json(
      { error: "Failed to create contact" },
      { status: 500 }
    );
  }
}
