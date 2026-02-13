"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

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
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRightIcon } from "lucide-react";

interface RecentConversation {
  id: string;
  status: string;
  created_at: string;
  customer_name: string;
  customer_email: string;
  last_message: string;
}

interface RecentConversationsProps {
  data?: RecentConversation[];
  loading?: boolean;
}

const getInitials = (name: string) => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

export function RecentConversations({ data, loading }: RecentConversationsProps) {
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
              {loading ? (
                [...Array(3)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-8 w-32" /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  </TableRow>
                ))
              ) : data && data.length > 0 ? (
                data.map((conv) => {
                  const statusMap: Record<string, "success" | "warning" | "secondary"> = {
                    active: "success",
                    open: "success",
                    pending: "warning",
                    waiting: "warning",
                    resolved: "secondary",
                    closed: "secondary"
                  };

                  return (
                    <TableRow key={conv.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {getInitials(conv.customer_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{conv.customer_name}</div>
                            {conv.customer_email && (
                              <div className="text-muted-foreground hidden text-xs sm:block">
                                {conv.customer_email}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden max-w-[200px] truncate md:table-cell">
                        {conv.last_message || "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDistanceToNow(new Date(conv.created_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusMap[conv.status] || "secondary"} className="capitalize">
                          {conv.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No conversations in this period
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
