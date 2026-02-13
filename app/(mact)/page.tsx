"use client";

import { useState, useCallback } from "react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import CustomDateRangePicker from "@/components/custom-date-range-picker";
import {
  StatCards,
  ConversationsChart,
  RecentConversations,
  TeamStatus,
  TokenUsageWidget
} from "@/components/dashboard";

interface DashboardStats {
  summary: {
    totalConversations: number;
    activeConversations: number;
    resolvedConversations: number;
    pendingConversations: number;
    aiConversations: number;
    humanConversations: number;
    aiResolutionRate: number;
  };
  dailyConversations: Array<{ date: string; human: number; ai: number }>;
  recentConversations: Array<{
    id: string;
    status: string;
    created_at: string;
    customer_name: string;
    customer_email: string;
    last_message: string;
  }>;
  teamStatus: Array<{ name: string; status: string; role: string }>;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const handleDateChange = useCallback(async (range: DateRange | undefined) => {
    if (!range?.from) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("from", range.from.toISOString());
      if (range.to) params.set("to", range.to.toISOString());

      const res = await fetch(`/api/dashboard/stats?${params}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error("Failed to fetch dashboard stats:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-row items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Welcome back! Here is what is happening with your chatbot.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <CustomDateRangePicker onDateChange={handleDateChange} />
          <Button>
            <Download />
            <span className="hidden lg:inline">Download</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <StatCards data={stats?.summary} loading={loading} />

      {/* Main Content Grid */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Chart - Takes 8 columns on large screens */}
        <div className="lg:col-span-8 [&>*]:h-full">
          <ConversationsChart data={stats?.dailyConversations} loading={loading} />
        </div>

        {/* Team Status - Takes 4 columns on large screens */}
        <div className="lg:col-span-4 [&>*]:h-full">
          <TeamStatus data={stats?.teamStatus} loading={loading} />
        </div>
      </div>

      {/* Token Usage */}
      <TokenUsageWidget />

      {/* Recent Conversations */}
      <RecentConversations data={stats?.recentConversations} loading={loading} />
    </div>
  );
}
