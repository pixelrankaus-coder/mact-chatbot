"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ArrowRightIcon } from "lucide-react";

export type Conversation = {
  id: number;
  customer: {
    name: string;
    email: string;
  };
  lastMessage: string;
  time: string;
  status: "active" | "pending" | "resolved";
};

const conversations: Conversation[] = [
  {
    id: 1,
    customer: { name: "John Smith", email: "john@example.com" },
    lastMessage: "Looking for GFRC panels pricing...",
    time: "2m ago",
    status: "active"
  },
  {
    id: 2,
    customer: { name: "Sarah Johnson", email: "sarah@example.com" },
    lastMessage: "Do you ship to California?",
    time: "15m ago",
    status: "resolved"
  },
  {
    id: 3,
    customer: { name: "Mike Wilson", email: "mike@example.com" },
    lastMessage: "Need custom sizes for my project",
    time: "1h ago",
    status: "pending"
  },
  {
    id: 4,
    customer: { name: "Emily Davis", email: "emily@example.com" },
    lastMessage: "What is the lead time for orders?",
    time: "2h ago",
    status: "resolved"
  },
  {
    id: 5,
    customer: { name: "Robert Brown", email: "robert@example.com" },
    lastMessage: "Can you provide samples?",
    time: "3h ago",
    status: "active"
  }
];

const getInitials = (name: string) => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

export function RecentConversations() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Conversations</CardTitle>
        <CardAction className="relative">
          <Button variant="outline" size="sm" asChild>
            <Link href="/inbox">
              View all <ArrowRightIcon className="ms-2 size-4" />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead className="hidden md:table-cell">Message</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {conversations.map((conv) => {
                const statusMap = {
                  active: "success",
                  pending: "warning",
                  resolved: "secondary"
                } as const;

                return (
                  <TableRow key={conv.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            {getInitials(conv.customer.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{conv.customer.name}</div>
                          <div className="text-muted-foreground hidden text-xs sm:block">
                            {conv.customer.email}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden max-w-[200px] truncate md:table-cell">
                      {conv.lastMessage}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{conv.time}</TableCell>
                    <TableCell>
                      <Badge variant={statusMap[conv.status]} className="capitalize">
                        {conv.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
