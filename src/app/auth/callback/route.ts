import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

/**
 * Auth Callback Route
 *
 * Handles OAuth callbacks and email confirmation links.
 * Exchanges the auth code for a session.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/inbox";
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
    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (!exchangeError) {
      // Successfully exchanged code for session
      return NextResponse.redirect(`${origin}${next}`);
    }

    // Exchange failed
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", exchangeError.message);
    return NextResponse.redirect(loginUrl);
  }

  // No code provided - redirect to login
  const loginUrl = new URL("/login", origin);
  loginUrl.searchParams.set("error", "Authentication failed - no code provided");
  return NextResponse.redirect(loginUrl);
}
