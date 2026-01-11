"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { Json } from "@/types/database";

export function useSettings<T extends Json>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(defaultValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const defaultValueRef = useRef(defaultValue);

  // Fetch setting by key
  const fetchSetting = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("settings")
        .select("value")
        .eq("key", key)
        .single();

      if (error) {
        // If not found, use default value
        if (error.code === "PGRST116") {
          setValue(defaultValueRef.current);
        } else {
          throw error;
        }
      } else {
        setValue(data.value as T);
      }
    } catch (err) {
      setError(err as Error);
      setValue(defaultValueRef.current);
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    fetchSetting();
  }, [fetchSetting]);

  // Update setting
  const updateSetting = async (newValue: T) => {
    const { error } = await supabase
      .from("settings")
      .upsert(
        { key, value: newValue as Json },
        { onConflict: "key" }
      );

    if (error) throw error;
    setValue(newValue);
  };

  return {
    value,
    loading,
    error,
    updateSetting,
    refetch: fetchSetting,
  };
}

// Pre-defined hooks for common settings
export function useAppearanceSettings() {
  return useSettings("appearance", {
    backgroundColor: "#1a1a2e",
    actionColor: "#3b82f6",
    welcomeTitle: "Hi there!",
    welcomeSubtitle: "How can we help you today?",
    chatPlaceholder: "Type your message...",
    agentName: "MACt Assistant",
    position: "bottom-right" as const,
  });
}

interface AIAgentSettings {
  enabled: boolean;
  name: string;
  welcomeMessage: string;
  personality: "professional" | "friendly" | "casual";
  responseLength: number;
  fallbackAction: "clarify" | "transfer" | "email";
}

export function useAIAgentSettings() {
  return useSettings<AIAgentSettings>("ai_agent", {
    enabled: true,
    name: "MACt Assistant",
    welcomeMessage: "Hi there! I'm the MACt Assistant. How can I help you with your GFRC project today?",
    personality: "professional",
    responseLength: 50,
    fallbackAction: "clarify",
  });
}

export function useOperatingHoursSettings() {
  return useSettings("operating_hours", {
    enabled: true,
    timezone: "Australia/Perth",
    schedule: [
      { day: "Monday", shortDay: "Mon", enabled: true, start: "9:00 AM", end: "5:00 PM" },
      { day: "Tuesday", shortDay: "Tue", enabled: true, start: "9:00 AM", end: "5:00 PM" },
      { day: "Wednesday", shortDay: "Wed", enabled: true, start: "9:00 AM", end: "5:00 PM" },
      { day: "Thursday", shortDay: "Thu", enabled: true, start: "9:00 AM", end: "5:00 PM" },
      { day: "Friday", shortDay: "Fri", enabled: true, start: "9:00 AM", end: "5:00 PM" },
      { day: "Saturday", shortDay: "Sat", enabled: false, start: "10:00 AM", end: "2:00 PM" },
      { day: "Sunday", shortDay: "Sun", enabled: false, start: "10:00 AM", end: "2:00 PM" },
    ],
    outsideHoursBehavior: "ai-agent" as const,
    offlineMessage: "We're currently offline. Please leave your email and message, and we'll get back to you as soon as possible.",
  });
}
