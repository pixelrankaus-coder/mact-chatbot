import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/auth/bootstrap
 *
 * Creates the first admin user. Only works when no agents exist.
 * This is a one-time setup endpoint for initial deployment.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name } = body;

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "Email, password, and name are required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // Create Supabase admin client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseServiceKey) {
      return NextResponse.json(
        { error: "Server not configured for user creation (missing service role key)" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Check if any agents already exist
    const { data: existingAgents, error: checkError } = await supabase
      .from("agents")
      .select("id")
      .limit(1);

    if (checkError) {
      console.error("Failed to check existing agents:", checkError);
      return NextResponse.json(
        { error: "Failed to check existing agents" },
        { status: 500 }
      );
    }

    if (existingAgents && existingAgents.length > 0) {
      return NextResponse.json(
        { error: "Bootstrap already completed. Use /settings/team to add more users." },
        { status: 403 }
      );
    }

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      console.error("Auth error:", authError);
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    // Create agent record as owner
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .insert({
        email,
        name,
        role: "owner",
        is_online: false,
      })
      .select()
      .single();

    if (agentError) {
      // Rollback: delete auth user if agent creation fails
      if (authData.user) {
        await supabase.auth.admin.deleteUser(authData.user.id);
      }
      console.error("Agent creation error:", agentError);
      return NextResponse.json(
        { error: "Failed to create agent record: " + agentError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Admin account created successfully. You can now log in.",
      agent: {
        id: agent.id,
        email: agent.email,
        name: agent.name,
        role: agent.role,
      },
    });
  } catch (error) {
    console.error("Bootstrap error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET endpoint to check if bootstrap is needed
export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: agents, error } = await supabase
      .from("agents")
      .select("id")
      .limit(1);

    if (error) {
      return NextResponse.json({ error: "Failed to check agents" }, { status: 500 });
    }

    const needsBootstrap = !agents || agents.length === 0;

    return NextResponse.json({
      needsBootstrap,
      message: needsBootstrap
        ? "No admin exists. POST to this endpoint with {email, password, name} to create the first admin."
        : "Bootstrap already completed.",
    });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
