import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Create supabase admin client with service role key
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// GET /api/agents - List all agents
export async function GET() {
  const supabase = getSupabaseAdmin();

  try {
    const { data, error } = await supabase
      .from("agents")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch agents:", error);
    return NextResponse.json(
      { error: "Failed to fetch agents" },
      { status: 500 }
    );
  }
}

// POST /api/agents - Create a new agent
export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin();

  try {
    const body = await request.json();
    const { email, password, name, role } = body;

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "Email, password, and name are required" },
        { status: 400 }
      );
    }

    // Check if agent already exists
    const { data: existingAgent } = await supabase
      .from("agents")
      .select("id")
      .eq("email", email)
      .single();

    if (existingAgent) {
      return NextResponse.json(
        { error: "An agent with this email already exists" },
        { status: 400 }
      );
    }

    // Create auth user using admin API
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
    });

    if (authError) {
      console.error("Auth error:", authError);
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    // Create agent record
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .insert({
        email,
        name,
        role: role || "agent",
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
        { error: "Failed to create agent record" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      agent,
    });
  } catch (error) {
    console.error("Failed to create agent:", error);
    return NextResponse.json(
      { error: "Failed to create agent" },
      { status: 500 }
    );
  }
}

// DELETE /api/agents?id=xxx&email=xxx - Delete an agent
export async function DELETE(request: NextRequest) {
  const supabase = getSupabaseAdmin();

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const email = searchParams.get("email");

    if (!id || !email) {
      return NextResponse.json(
        { error: "Agent ID and email are required" },
        { status: 400 }
      );
    }

    // Get auth user by email
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
      console.error("Failed to list users:", listError);
    } else {
      const authUser = users.users.find((u) => u.email === email);
      if (authUser) {
        // Delete auth user
        const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(authUser.id);
        if (deleteAuthError) {
          console.error("Failed to delete auth user:", deleteAuthError);
        }
      }
    }

    // Delete agent record
    const { error: deleteError } = await supabase
      .from("agents")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Failed to delete agent:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete agent" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete agent:", error);
    return NextResponse.json(
      { error: "Failed to delete agent" },
      { status: 500 }
    );
  }
}

// PATCH /api/agents - Update an agent
export async function PATCH(request: NextRequest) {
  const supabase = getSupabaseAdmin();

  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Agent ID is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("agents")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, agent: data });
  } catch (error) {
    console.error("Failed to update agent:", error);
    return NextResponse.json(
      { error: "Failed to update agent" },
      { status: 500 }
    );
  }
}

// PUT /api/agents - Reset agent password
export async function PUT(request: NextRequest) {
  const supabase = getSupabaseAdmin();

  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and new password are required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // Find auth user by email
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
      console.error("Failed to list users:", listError);
      return NextResponse.json(
        { error: "Failed to find user" },
        { status: 500 }
      );
    }

    const authUser = users.users.find((u) => u.email === email);
    if (!authUser) {
      return NextResponse.json(
        { error: "User not found in auth system" },
        { status: 404 }
      );
    }

    // Update password using admin API
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      authUser.id,
      { password }
    );

    if (updateError) {
      console.error("Failed to update password:", updateError);
      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    console.error("Failed to reset password:", error);
    return NextResponse.json(
      { error: "Failed to reset password" },
      { status: 500 }
    );
  }
}
