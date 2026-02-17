import { supabase } from "@/lib/supabase";

// Re-export the singleton client to prevent multiple GoTrueClient instances
export function createClient() {
  return supabase;
}
