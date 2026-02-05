"use client";

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

export default function DashboardPage() {
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
          <CustomDateRangePicker />
          <Button>
            <Download />
            <span className="hidden lg:inline">Download</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <StatCards />

      {/* Main Content Grid */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Chart - Takes 8 columns on large screens */}
        <div className="lg:col-span-8 [&>*]:h-full">
          <ConversationsChart />
        </div>

        {/* Team Status - Takes 4 columns on large screens */}
        <div className="lg:col-span-4 [&>*]:h-full">
          <TeamStatus />
        </div>
      </div>

      {/* Token Usage */}
      <TokenUsageWidget />

      {/* Recent Conversations */}
      <RecentConversations />
    </div>
  );
}
