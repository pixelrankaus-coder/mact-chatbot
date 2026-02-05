"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";

export interface Agent {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  role: "owner" | "admin" | "agent";
  is_online: boolean;
  last_seen_at?: string;
  operating_hours?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface AgentContextType {
  agent: Agent | null;
  user: User | null;
  loading: boolean;
  setOnlineStatus: (online: boolean) => Promise<void>;
  updateAgent: (updates: Partial<Agent>) => Promise<void>;
  logout: () => Promise<void>;
  refreshAgent: () => Promise<void>;
}

const AgentContext = createContext<AgentContextType | null>(null);

interface AgentProviderProps {
  children: ReactNode;
}

export function AgentProvider({ children }: AgentProviderProps) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAgent = useCallback(async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      setUser(authUser);

      if (authUser?.email) {
        const { data, error } = await supabase
          .from("agents")
          .select("*")
          .eq("email", authUser.email)
          .single();

        if (error && error.code !== "PGRST116") {
          console.error("Failed to load agent:", error);
        }

        setAgent(data || null);
      } else {
        setAgent(null);
      }
    } catch (error) {
      console.error("Error loading agent:", error);
      setAgent(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAgent();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") {
        await loadAgent();
      }
    });

    return () => subscription.unsubscribe();
  }, [loadAgent]);

  // Update last_seen periodically when online
  useEffect(() => {
    if (!agent?.is_online) return;

    const interval = setInterval(async () => {
      await supabase
        .from("agents")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", agent.id);
    }, 60000); // Every minute

    return () => clearInterval(interval);
  }, [agent?.id, agent?.is_online]);

  const setOnlineStatus = useCallback(async (online: boolean) => {
    if (!agent) return;

    const { error } = await supabase
      .from("agents")
      .update({
        is_online: online,
        last_seen_at: new Date().toISOString()
      })
      .eq("id", agent.id);

    if (error) {
      console.error("Failed to update online status:", error);
      return;
    }

    setAgent({ ...agent, is_online: online, last_seen_at: new Date().toISOString() });
  }, [agent]);

  const updateAgent = useCallback(async (updates: Partial<Agent>) => {
    if (!agent) return;

    const { error } = await supabase
      .from("agents")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", agent.id);

    if (error) {
      console.error("Failed to update agent:", error);
      return;
    }

    setAgent({ ...agent, ...updates, updated_at: new Date().toISOString() });
  }, [agent]);

  const logout = useCallback(async () => {
    if (agent) {
      await supabase
        .from("agents")
        .update({ is_online: false, last_seen_at: new Date().toISOString() })
        .eq("id", agent.id);
    }

    await supabase.auth.signOut();
    setAgent(null);
    setUser(null);
  }, [agent]);

  const refreshAgent = useCallback(async () => {
    await loadAgent();
  }, [loadAgent]);

  return (
    <AgentContext.Provider
      value={{
        agent,
        user,
        loading,
        setOnlineStatus,
        updateAgent,
        logout,
        refreshAgent,
      }}
    >
      {children}
    </AgentContext.Provider>
  );
}

export function useAgent() {
  const context = useContext(AgentContext);
  if (!context) {
    throw new Error("useAgent must be used within an AgentProvider");
  }
  return context;
}

// Optional hook that doesn't throw if context is missing
export function useAgentOptional() {
  return useContext(AgentContext);
}
