"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { Json } from "@/types/database";

export function useSettings<T extends Json>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(defaultValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const defaultValueRef = useRef(defaultValue);

  // Fetch setting by key via API (uses service role, bypasses RLS)
  const fetchSetting = useCallback(async () => {
    try {
      setLoading(true);

      const res = await fetch(`/api/settings?key=${encodeURIComponent(key)}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to fetch setting");

      if (data.value !== null) {
        setValue(data.value as T);
      } else {
        setValue(defaultValueRef.current);
      }
    } catch (err) {
      console.error(`Failed to fetch setting "${key}":`, err);
      setError(err as Error);
      setValue(defaultValueRef.current);
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    fetchSetting();
  }, [fetchSetting]);

  // Update setting via API
  const updateSetting = async (newValue: T) => {
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value: newValue }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to update setting");
    }

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

// Appearance settings interface
interface AppearanceSettings {
  backgroundColor?: string;
  primaryColor?: string;
  actionColor?: string;
  welcomeTitle?: string;
  welcomeSubtitle?: string;
  chatPlaceholder?: string;
  agentName?: string;
  position?: string;
  desktop?: {
    display?: boolean;
    position?: "left" | "right";
    buttonType?: "corner" | "sidebar";
  };
  mobile?: {
    display?: boolean;
    position?: "left" | "right";
    buttonType?: "corner" | "sidebar";
    buttonSize?: number;
  };
  offsetX?: number;
  offsetY?: number;
  zIndex?: number;
  bubbleSize?: "small" | "medium" | "large";
  bubbleIconColor?: string;
  showBubbleText?: boolean;
  chatWindowHeight?: "small" | "medium" | "large";
  showWhenOffline?: boolean;
  enableSounds?: boolean;
  [key: string]: unknown; // Allow additional properties
}

// Pre-defined hooks for common settings
export function useAppearanceSettings() {
  return useSettings<AppearanceSettings>("appearance", {
    backgroundColor: "#1a1a2e",
    primaryColor: "#3b82f6",
    actionColor: "#3b82f6",
    welcomeTitle: "Hi there!",
    welcomeSubtitle: "How can we help you today?",
    chatPlaceholder: "Type your message...",
    agentName: "MACt Assistant",
    position: "bottom-right",
    desktop: {
      display: true,
      position: "right",
      buttonType: "corner",
    },
    mobile: {
      display: true,
      position: "right",
      buttonType: "corner",
      buttonSize: 50,
    },
    offsetX: 20,
    offsetY: 80,
    zIndex: 999999,
    bubbleSize: "medium",
    bubbleIconColor: "#ffffff",
    showBubbleText: false,
    chatWindowHeight: "medium",
    showWhenOffline: true,
    enableSounds: false,
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
