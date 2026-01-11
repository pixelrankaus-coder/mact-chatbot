"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, subscribeToConversations } from "@/lib/supabase";
import type { Database } from "@/types/database";

type Conversation = Database["public"]["Tables"]["conversations"]["Row"];

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch all conversations
  const fetchConversations = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setConversations(data || []);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

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
  const updateStatus = async (
    conversationId: string,
    status: "active" | "pending" | "resolved"
  ) => {
    const { error } = await supabase
      .from("conversations")
      .update({ status })
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
