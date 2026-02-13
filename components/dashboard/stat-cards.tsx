"use client";

import { cn } from "@/lib/utils";
import { ArrowRightIcon, MessageSquare, Users, Clock, Bot } from "lucide-react";
import Link from "next/link";

import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface StatCardsProps {
  data?: {
    totalConversations: number;
    activeConversations: number;
    resolvedConversations: number;
    aiResolutionRate: number;
  };
  loading?: boolean;
}

export default function StatCards({ data, loading }: StatCardsProps) {
  const stats = [
    {
      name: "Total Conversations",
      value: data?.totalConversations ?? 0,
      href: "/inbox",
      icon: MessageSquare
    },
    {
      name: "Active",
      value: data?.activeConversations ?? 0,
      href: "/inbox",
      icon: Users
    },
    {
      name: "Resolved",
      value: data?.resolvedConversations ?? 0,
      href: "/inbox",
      icon: Clock
    },
    {
      name: "AI Resolution Rate",
      value: `${data?.aiResolutionRate ?? 0}%`,
      href: "/ai-agent",
      icon: Bot
    }
  ];

  return (
    <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {stats.map((item) => (
        <Card key={item.name} className="py-0">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-start justify-between space-x-2">
              <div className="flex items-center gap-2">
                <div className="bg-muted flex size-10 items-center justify-center rounded-full border">
                  <item.icon className="size-5" />
                </div>
                <span className="text-muted-foreground truncate text-sm">{item.name}</span>
              </div>
            </div>
            {loading ? (
              <Skeleton className="h-9 w-20" />
            ) : (
              <dd className="text-foreground mt-1 text-3xl font-semibold">{item.value}</dd>
            )}
          </CardContent>
          <CardFooter className="border-border flex justify-end border-t p-0!">
            <Link
              href={item.href}
              className="text-primary hover:text-primary/90 flex items-center px-6 py-3 text-sm font-medium">
              View more <ArrowRightIcon className="ms-2 size-4" />
            </Link>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
