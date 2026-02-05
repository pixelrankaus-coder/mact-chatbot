"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bot, CheckCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const operatorStatus = [
  { name: "AI Agent", status: "online", conversations: 12 },
  { name: "Admin", status: "online", conversations: 3 }
];

const quickStats = [
  { label: "Resolved Today", value: 42, icon: CheckCircle, color: "text-emerald-600" },
  { label: "Pending", value: 8, icon: Clock, color: "text-amber-600" }
];

export function TeamStatus() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Team Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Team Members */}
        <div className="space-y-4">
          {operatorStatus.map((operator) => (
            <div key={operator.name} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback
                      className={cn(
                        operator.name === "AI Agent"
                          ? "bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-400"
                          : "bg-primary/10 text-primary"
                      )}>
                      {operator.name === "AI Agent" ? <Bot className="h-5 w-5" /> : "A"}
                    </AvatarFallback>
                  </Avatar>
                  <span
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card",
                      operator.status === "online" ? "bg-emerald-500" : "bg-slate-400"
                    )}
                  />
                </div>
                <div>
                  <p className="text-sm font-medium">{operator.name}</p>
                  <p className="text-muted-foreground text-xs">{operator.conversations} active</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Stats */}
        <div className="border-t pt-4">
          <p className="text-muted-foreground mb-3 text-xs font-medium uppercase">Quick Stats</p>
          <div className="space-y-3">
            {quickStats.map((stat) => (
              <div
                key={stat.label}
                className="bg-muted/50 flex items-center justify-between rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <stat.icon className={cn("h-4 w-4", stat.color)} />
                  <span className="text-muted-foreground text-sm">{stat.label}</span>
                </div>
                <span className="font-semibold">{stat.value}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
