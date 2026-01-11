"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, subscribeToMessages } from "@/lib/supabase";
import type { Database, SenderType } from "@/types/database";

type Message = Database["public"]["Tables"]["messages"]["Row"];

export function useMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch messages for a conversation
  const fetchMessages = useCallback(async () => {
    if (!conversationId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  // Subscribe to realtime message updates
  useEffect(() => {
    if (!conversationId) return;

    fetchMessages();

    const unsubscribe = subscribeToMessages(conversationId, (newMessage) => {
      setMessages((prev) => [...prev, newMessage]);
    });

    return () => {
      unsubscribe();
    };
  }, [conversationId, fetchMessages]);

  // Send a new message
  const sendMessage = async (
    content: string,
    senderType: SenderType,
    senderName: string
  ) => {
    if (!conversationId) throw new Error("No conversation selected");

    const { data, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        content,
        sender_type: senderType,
        sender_name: senderName,
      })
      .select()
      .single();

    if (error) throw error;

    // Also update conversation's updated_at
    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);

    return data;
  };

  return {
    messages,
    loading,
    error,
    refetch: fetchMessages,
    sendMessage,
  };
}
