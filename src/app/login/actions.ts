"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

/**
 * Server Action: Login
 *
 * Handles user authentication using server-side Supabase client.
 * More reliable than client-side auth - no race conditions or hanging.
 */
export async function login(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const redirectTo = formData.get("redirect") as string | null;

  // Authenticate with Supabase
  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    });

  if (authError) {
    const params = new URLSearchParams({ error: authError.message });
    if (redirectTo) params.set("redirect", redirectTo);
    redirect(`/login?${params.toString()}`);
  }

  // Check if user has an agent record (required for this app)
  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select("id")
    .eq("email", email.toLowerCase())
    .single();

  if (agentError || !agent) {
    // User authenticated but no agent record - sign them out
    await supabase.auth.signOut();
    const params = new URLSearchParams({
      error: "You are not authorized as an agent. Please contact an administrator.",
    });
    if (redirectTo) params.set("redirect", redirectTo);
    redirect(`/login?${params.toString()}`);
  }

  // Set agent online status
  await supabase
    .from("agents")
    .update({
      is_online: true,
      last_seen_at: new Date().toISOString(),
    })
    .eq("id", agent.id);

  // Revalidate and redirect
  revalidatePath("/", "layout");
  redirect(redirectTo || "/inbox");
}

/**
 * Server Action: Login with Google
 *
 * Initiates OAuth flow with Google provider.
 */
export async function loginWithGoogle(redirectTo?: string) {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/callback${redirectTo ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`,
    },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  if (data.url) {
    redirect(data.url);
  }
}

/**
 * Server Action: Login with GitHub
 *
 * Initiates OAuth flow with GitHub provider.
 */
export async function loginWithGithub(redirectTo?: string) {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/callback${redirectTo ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`,
    },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  if (data.url) {
    redirect(data.url);
  }
}

/**
 * Server Action: Logout
 *
 * Signs out the user and updates their online status.
 */
export async function logout() {
  const supabase = await createClient();

  // Get current user to update their agent record
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.email) {
    // Update online status before signing out
    await supabase
      .from("agents")
      .update({
        is_online: false,
        last_seen_at: new Date().toISOString(),
      })
      .eq("email", user.email.toLowerCase());
  }

  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
