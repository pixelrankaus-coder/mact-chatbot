"use client";

import { BellIcon, ClockIcon } from "lucide-react";
import Link from "next/link";
import { useIsMobile } from "@/hooks/use-mobile";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

type Notification = {
  id: number;
  title: string;
  desc: string;
  date: string;
  unread: boolean;
};

const notifications: Notification[] = [
  {
    id: 1,
    title: "New conversation assigned",
    desc: "John Smith started a chat about GFRC panels",
    date: "2 min ago",
    unread: true
  },
  {
    id: 2,
    title: "AI handoff requested",
    desc: "Customer requested to speak with a human agent",
    date: "15 min ago",
    unread: true
  },
  {
    id: 3,
    title: "Customer feedback received",
    desc: "Sarah Johnson rated the conversation 5 stars",
    date: "1 hour ago",
    unread: false
  }
];

const Notifications = () => {
  const isMobile = useIsMobile();
  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" className="relative">
          <BellIcon className="size-5" />
          {unreadCount > 0 && (
            <span className="bg-destructive absolute right-1 top-1 block size-2 rounded-full" />
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align={isMobile ? "center" : "end"} className="w-80 p-0">
        <DropdownMenuLabel className="bg-background sticky top-0 z-10 p-0">
          <div className="flex justify-between border-b px-4 py-3">
            <div className="font-medium">Notifications</div>
            <Button variant="link" className="h-auto p-0 text-xs" asChild>
              <Link href="/inbox">View all</Link>
            </Button>
          </div>
        </DropdownMenuLabel>

        <ScrollArea className="max-h-[300px]">
          {notifications.map((item) => (
            <DropdownMenuItem
              key={item.id}
              className="flex cursor-pointer items-start gap-3 rounded-none border-b px-4 py-3 last:border-b-0">
              <Avatar className="size-8 flex-shrink-0">
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {item.title.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-1 flex-col gap-1 overflow-hidden">
                <div className="truncate text-sm font-medium">{item.title}</div>
                <div className="text-muted-foreground line-clamp-1 text-xs">{item.desc}</div>
                <div className="text-muted-foreground flex items-center gap-1 text-xs">
                  <ClockIcon className="size-3" />
                  {item.date}
                </div>
              </div>
              {item.unread && (
                <span className="bg-destructive mt-1 block size-2 flex-shrink-0 rounded-full" />
              )}
            </DropdownMenuItem>
          ))}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default Notifications;
