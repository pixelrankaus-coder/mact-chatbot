"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface TeamMember {
  name: string;
  status: string;
  role: string;
}

interface TeamStatusProps {
  data?: TeamMember[];
  loading?: boolean;
}

export function TeamStatus({ data, loading }: TeamStatusProps) {
  // Always show AI Agent first
  const members = data && data.length > 0
    ? data
    : [{ name: "AI Agent", status: "online", role: "bot" }];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          {loading ? (
            [...Array(2)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))
          ) : (
            members.map((member) => (
              <div key={member.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback
                        className={cn(
                          member.role === "bot"
                            ? "bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-400"
                            : "bg-primary/10 text-primary"
                        )}>
                        {member.role === "bot" ? (
                          <Bot className="h-5 w-5" />
                        ) : (
                          member.name.charAt(0).toUpperCase()
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <span
                      className={cn(
                        "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card",
                        member.status === "online" ? "bg-emerald-500" : "bg-slate-400"
                      )}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{member.name}</p>
                    <p className="text-muted-foreground text-xs capitalize">{member.status}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
