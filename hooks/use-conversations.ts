"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, subscribeToConversations } from "@/lib/supabase";
import type { Database } from "@/types/database";

type Conversation = Database["public"]["Tables"]["conversations"]["Row"];
type ConversationStatus = "active" | "pending" | "resolved";

interface UseConversationsOptions {
  // Task 043: Filter by status (default: all)
  status?: ConversationStatus | ConversationStatus[] | "all";
  // Exclude resolved by default for active inbox view
  excludeResolved?: boolean;
}

export function useConversations(options: UseConversationsOptions = {}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch conversations via API (uses service role, bypasses RLS)
  const fetchConversations = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      if (options.status && options.status !== "all") {
        if (Array.isArray(options.status)) {
          // For array status, fetch all and filter client-side
          params.set("status", "all");
        } else {
          params.set("status", options.status);
        }
      }
      if (options.excludeResolved) {
        params.set("excludeResolved", "true");
      }

      const res = await fetch(`/api/conversations?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to fetch conversations");

      let convs = data.conversations || [];

      // Client-side filter for array status
      if (Array.isArray(options.status)) {
        convs = convs.filter((c: Conversation) =>
          (options.status as ConversationStatus[]).includes(c.status as ConversationStatus)
        );
      }

      setConversations(convs);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [options.status, options.excludeResolved]);

  // Subscribe to realtime updates
  useEffect(() => {
    fetchConversations();

    const unsubscribe = subscribeToConversations(
      // On insert
      (payload) => {
        setConversations((prev) => [payload.new, ...prev]);
      },
      // On update
      (payload) => {
        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === payload.new.id ? payload.new : conv
          )
        );
      }
    );

    return () => {
      unsubscribe();
    };
  }, [fetchConversations]);

  // Create a new conversation
  const createConversation = async (
    visitorId: string,
    visitorName?: string,
    visitorEmail?: string
  ) => {
    const { data, error } = await supabase
      .from("conversations")
      .insert({
        visitor_id: visitorId,
        visitor_name: visitorName,
        visitor_email: visitorEmail,
        status: "active",
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  // Update conversation status via API
  const updateStatus = async (
    conversationId: string,
    status: "active" | "pending" | "resolved"
  ) => {
    const res = await fetch("/api/conversations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: conversationId, status }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to update status");
    }
  };

  // Assign conversation to agent via API
  const assignToAgent = async (conversationId: string, agentId: string | null) => {
    const res = await fetch("/api/conversations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: conversationId, assigned_to: agentId }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to assign agent");
    }
  };

  return {
    conversations,
    loading,
    error,
    refetch: fetchConversations,
    createConversation,
    updateStatus,
    assignToAgent,
  };
}
