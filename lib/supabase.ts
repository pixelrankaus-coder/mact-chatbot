import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Singleton client-side Supabase client to prevent multiple GoTrueClient instances
const globalForSupabase = globalThis as unknown as {
  supabaseClient: SupabaseClient<Database> | undefined;
};

export const supabase =
  globalForSupabase.supabaseClient ??
  createClient<Database>(supabaseUrl, supabaseAnonKey);

if (typeof window !== "undefined") {
  globalForSupabase.supabaseClient = supabase;
}

// Server-side Supabase client with service role (for admin operations)
export function createServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Realtime subscription helper for conversations
export function subscribeToConversations(
  onInsert?: (payload: { new: Database["public"]["Tables"]["conversations"]["Row"] }) => void,
  onUpdate?: (payload: { new: Database["public"]["Tables"]["conversations"]["Row"]; old: Database["public"]["Tables"]["conversations"]["Row"] }) => void
) {
  const channel = supabase
    .channel("conversations-changes")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "conversations",
      },
      (payload) => {
        if (onInsert) {
          onInsert(payload as { new: Database["public"]["Tables"]["conversations"]["Row"] });
        }
      }
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "conversations",
      },
      (payload) => {
        if (onUpdate) {
          onUpdate(payload as {
            new: Database["public"]["Tables"]["conversations"]["Row"];
            old: Database["public"]["Tables"]["conversations"]["Row"]
          });
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// Realtime subscription helper for messages in a conversation
export function subscribeToMessages(
  conversationId: string,
  onNewMessage: (message: Database["public"]["Tables"]["messages"]["Row"]) => void
) {
  const channel = supabase
    .channel(`messages-${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        onNewMessage(payload.new as Database["public"]["Tables"]["messages"]["Row"]);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
