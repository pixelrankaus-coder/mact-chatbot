"use client";

import { useEffect, useState, useCallback } from "react";
import { subscribeToMessages } from "@/lib/supabase";
import type { Database, SenderType } from "@/types/database";

type Message = Database["public"]["Tables"]["messages"]["Row"];

export function useMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch messages via API (uses service role, bypasses RLS)
  const fetchMessages = useCallback(async () => {
    if (!conversationId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`/api/conversations/${conversationId}/messages`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to fetch messages");
      setMessages(data.messages || []);
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

  // Send a new message via API
  const sendMessage = async (
    content: string,
    senderType: SenderType,
    senderName: string
  ) => {
    if (!conversationId) throw new Error("No conversation selected");

    const res = await fetch(`/api/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, senderType, senderName }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to send message");

    return data.message;
  };

  return {
    messages,
    loading,
    error,
    refetch: fetchMessages,
    sendMessage,
  };
}
