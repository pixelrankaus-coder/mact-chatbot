import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// GET: Get current Google Ads connection
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: connection, error } = await supabase
      .from("ppc_connections")
      .select("id, customer_id, account_name, last_sync_at, sync_status, sync_error, is_active, created_at")
      .eq("is_active", true)
      .single();

    if (error) {
      // PGRST116 = no rows returned (expected when no connection exists)
      if (error.code !== "PGRST116") {
        console.error("Error fetching PPC connection:", error);
      }
      return NextResponse.json({ connection: null });
    }

    return NextResponse.json({ connection: connection || null });
  } catch (error) {
    console.error("PPC connection error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: Create or update Google Ads connection
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const body = await req.json();

    const { customer_id, account_name, refresh_token, access_token, token_expires_at, developer_token, login_customer_id } = body;

    if (!customer_id) {
      return NextResponse.json({ error: "Customer ID is required" }, { status: 400 });
    }

    // Upsert the connection
    const { data, error } = await supabase
      .from("ppc_connections")
      .upsert(
        {
          customer_id: customer_id.replace(/-/g, ""), // Remove dashes from customer ID
          account_name,
          refresh_token,
          access_token,
          token_expires_at,
          developer_token,
          login_customer_id: login_customer_id?.replace(/-/g, ""),
          is_active: true,
          sync_status: "pending",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "customer_id" }
      )
      .select()
      .single();

    if (error) {
      console.error("Error creating PPC connection:", error);
      return NextResponse.json({ error: "Failed to create connection" }, { status: 500 });
    }

    return NextResponse.json({ connection: data });
  } catch (error) {
    console.error("PPC connection create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE: Disconnect Google Ads
export async function DELETE() {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from("ppc_connections")
      .update({
        is_active: false,
        refresh_token: null,
        access_token: null,
        updated_at: new Date().toISOString(),
      })
      .eq("is_active", true);

    if (error) {
      console.error("Error disconnecting PPC:", error);
      return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PPC disconnect error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
