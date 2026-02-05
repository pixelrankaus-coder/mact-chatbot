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

  // Fetch all conversations with optional status filter
  const fetchConversations = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("conversations")
        .select("*")
        .order("updated_at", { ascending: false });

      // Task 043: Apply status filter if specified
      if (options.status && options.status !== "all") {
        if (Array.isArray(options.status)) {
          query = query.in("status", options.status);
        } else {
          query = query.eq("status", options.status);
        }
      } else if (options.excludeResolved) {
        // Exclude resolved conversations by default
        query = query.in("status", ["active", "pending"]);
      }

      const { data, error } = await query;

      if (error) throw error;
      setConversations(data || []);
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

  // Update conversation status
  // Task 043: Set resolved_at when resolving, clear it when reopening
  const updateStatus = async (
    conversationId: string,
    status: "active" | "pending" | "resolved"
  ) => {
    const updateData: Record<string, unknown> = { status };

    if (status === "resolved") {
      updateData.resolved_at = new Date().toISOString();
    } else {
      updateData.resolved_at = null;
    }

    const { error } = await supabase
      .from("conversations")
      .update(updateData)
      .eq("id", conversationId);

    if (error) throw error;
  };

  // Assign conversation to agent
  const assignToAgent = async (conversationId: string, agentId: string | null) => {
    const { error } = await supabase
      .from("conversations")
      .update({ assigned_to: agentId })
      .eq("id", conversationId);

    if (error) throw error;
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
