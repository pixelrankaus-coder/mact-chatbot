import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

/**
 * Auth Callback Route
 *
 * Handles OAuth callbacks and email confirmation links.
 * Exchanges the auth code for a session and verifies agent authorization.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirectTo = searchParams.get("redirect") || searchParams.get("next") || "/inbox";
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Handle OAuth errors
  if (error) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", errorDescription || error);
    return NextResponse.redirect(loginUrl);
  }

  if (code) {
    const supabase = await createClient();
    const { data: sessionData, error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      const loginUrl = new URL("/login", origin);
      loginUrl.searchParams.set("error", exchangeError.message);
      return NextResponse.redirect(loginUrl);
    }

    // Get the user's email from the session
    const userEmail = sessionData.user?.email;

    if (!userEmail) {
      await supabase.auth.signOut();
      const loginUrl = new URL("/login", origin);
      loginUrl.searchParams.set("error", "Could not retrieve email from OAuth provider");
      return NextResponse.redirect(loginUrl);
    }

    // Check if user has an agent record (required for this app)
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("id")
      .eq("email", userEmail.toLowerCase())
      .single();

    if (agentError || !agent) {
      // User authenticated but no agent record - sign them out
      await supabase.auth.signOut();
      const loginUrl = new URL("/login", origin);
      loginUrl.searchParams.set("error", "You are not authorized as an agent. Please contact an administrator.");
      return NextResponse.redirect(loginUrl);
    }

    // Set agent online status
    await supabase
      .from("agents")
      .update({
        is_online: true,
        last_seen_at: new Date().toISOString(),
      })
      .eq("id", agent.id);

    // Successfully authenticated and authorized
    return NextResponse.redirect(`${origin}${redirectTo}`);
  }

  // No code provided - redirect to login
  const loginUrl = new URL("/login", origin);
  loginUrl.searchParams.set("error", "Authentication failed - no code provided");
  return NextResponse.redirect(loginUrl);
}
