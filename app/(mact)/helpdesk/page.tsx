"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Inbox,
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Settings,
  RefreshCw,
  BellOff,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { TicketDetail } from "@/components/helpdesk/ticket-detail";
import { CustomerContext } from "@/components/helpdesk/customer-context";
import type {
  TicketStatus,
  HelpdeskTicketWithRelations,
  TicketStats,
} from "@/types/helpdesk";

// Status badge variants
const statusVariants: Record<TicketStatus, "info" | "warning" | "secondary" | "default"> = {
  open: "info",
  pending: "warning",
  snoozed: "secondary",
  closed: "default",
};

const priorityVariants = {
  low: "secondary",
  normal: "info",
  high: "warning",
  urgent: "destructive",
} as const;

// Nav link type
interface NavLink {
  value: string;
  label: string;
  icon: React.ElementType;
  count?: number;
}

export default function HelpdeskPage() {
  const [tickets, setTickets] = useState<HelpdeskTicketWithRelations[]>([]);
  const [stats, setStats] = useState<TicketStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [searchQuery, setSearchQuery] = useState("");
  const [helpdeskEnabled, setHelpdeskEnabled] = useState<boolean | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [readFilter, setReadFilter] = useState<"all" | "unread">("all");
  const isMobile = useIsMobile();

  // Fetch helpdesk settings and tickets
  useEffect(() => {
    fetchHelpdeskData();
  }, [statusFilter]);

  const fetchHelpdeskData = async () => {
    setLoading(true);
    try {
      // Check if helpdesk is enabled
      const settingsRes = await fetch("/api/helpdesk/settings");
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setHelpdeskEnabled(settingsData.enabled);
      }

      // Fetch tickets
      const ticketsRes = await fetch(
        `/api/helpdesk/tickets?status=${statusFilter}`
      );
      if (ticketsRes.ok) {
        const ticketsData = await ticketsRes.json();
        setTickets(ticketsData.tickets || []);
        setStats(ticketsData.stats || null);
      }
    } catch (error) {
      console.error("Failed to fetch helpdesk data:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return then.toLocaleDateString();
  };

  // Filter tickets by search query
  const filteredTickets = tickets.filter((ticket) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      ticket.subject?.toLowerCase().includes(query) ||
      ticket.conversation?.visitor_name?.toLowerCase().includes(query) ||
      ticket.conversation?.visitor_email?.toLowerCase().includes(query)
    );
  });

  // Get selected ticket
  const selectedTicket = selectedTicketId
    ? tickets.find((t) => t.id === selectedTicketId)
    : null;

  // Navigation links with counts
  const navLinks: NavLink[] = [
    { value: "open", label: "Open", icon: AlertCircle, count: stats?.open },
    { value: "pending", label: "Pending", icon: Clock, count: stats?.pending },
    { value: "snoozed", label: "Snoozed", icon: BellOff, count: stats?.snoozed },
    { value: "closed", label: "Closed", icon: CheckCircle2, count: stats?.closed },
    { value: "all", label: "All Tickets", icon: Inbox },
  ];

  // Show setup screen if helpdesk not enabled
  if (helpdeskEnabled === false) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center max-w-md">
          <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <Inbox className="size-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Helpdesk Module</h2>
          <p className="text-muted-foreground mb-6">
            The helpdesk module provides a unified inbox for managing customer
            conversations that require human attention. Enable it to start
            handling support tickets.
          </p>
          <Link href="/settings/helpdesk">
            <Button>
              <Settings className="size-4 mr-2" />
              Enable Helpdesk
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={0}>
      <div className="h-[calc(100vh-var(--header-height)-3rem)] rounded-md border">
        <ResizablePanelGroup
          direction="horizontal"
          className="items-stretch"
        >
          {/* Left Sidebar - Status Filters */}
          <ResizablePanel
            hidden={isMobile}
            defaultSize={15}
            collapsedSize={4}
            collapsible={true}
            minSize={12}
            maxSize={18}
            onCollapse={() => setIsCollapsed(true)}
            onResize={() => setIsCollapsed(false)}
            className={cn(isCollapsed && "min-w-[50px] transition-all duration-300 ease-in-out")}
          >
            <div className={cn("flex h-[52px] items-center", isCollapsed ? "justify-center" : "px-4")}>
              {isCollapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Inbox className="size-5" />
                  </TooltipTrigger>
                  <TooltipContent side="right">Helpdesk</TooltipContent>
                </Tooltip>
              ) : (
                <h1 className="text-lg font-semibold">Helpdesk</h1>
              )}
            </div>
            <Separator />

            {/* Nav Links */}
            <div className="flex flex-col gap-1 p-2">
              {navLinks.map((link) => (
                <Tooltip key={link.value}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setStatusFilter(link.value)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                        isCollapsed && "justify-center px-2",
                        statusFilter === link.value
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <link.icon className="size-4" />
                      {!isCollapsed && (
                        <>
                          <span className="flex-1 text-left">{link.label}</span>
                          {link.count !== undefined && (
                            <span className={cn(
                              "text-xs",
                              statusFilter === link.value ? "text-primary-foreground/80" : "text-muted-foreground"
                            )}>
                              {link.count}
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  </TooltipTrigger>
                  {isCollapsed && (
                    <TooltipContent side="right">
                      {link.label} {link.count !== undefined && `(${link.count})`}
                    </TooltipContent>
                  )}
                </Tooltip>
              ))}
            </div>

            <Separator />

            {/* Settings Link */}
            <div className="p-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/settings/helpdesk">
                    <button
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors",
                        isCollapsed && "justify-center px-2"
                      )}
                    >
                      <Settings className="size-4" />
                      {!isCollapsed && <span>Settings</span>}
                    </button>
                  </Link>
                </TooltipTrigger>
                {isCollapsed && (
                  <TooltipContent side="right">Settings</TooltipContent>
                )}
              </Tooltip>
            </div>
          </ResizablePanel>

          <ResizableHandle hidden={isMobile} withHandle />

          {/* Middle - Ticket List */}
          <ResizablePanel defaultSize={30} minSize={25}>
            <Tabs
              defaultValue="all"
              className="flex h-full flex-col gap-0"
              onValueChange={(value) => setReadFilter(value as "all" | "unread")}
            >
              <div className="flex items-center px-4 py-2">
                <div className="flex items-center gap-2">
                  {isMobile && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Inbox className="size-5" />
                      </TooltipTrigger>
                      <TooltipContent>Helpdesk</TooltipContent>
                    </Tooltip>
                  )}
                  <h1 className="text-xl font-bold">
                    {navLinks.find(l => l.value === statusFilter)?.label || "Tickets"}
                  </h1>
                </div>
                <TabsList className="ml-auto">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="unread">Unread</TabsTrigger>
                </TabsList>
              </div>
              <Separator />

              {/* Search */}
              <div className="bg-background/95 supports-[backdrop-filter]:bg-background/60 p-4 backdrop-blur">
                <form>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      placeholder="Search tickets..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </form>
              </div>

              {/* Ticket List */}
              <div className="min-h-0">
              <ScrollArea className="h-full">
              {loading ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredTickets.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                  <Inbox className="size-8 mb-2" />
                  <p className="text-sm">No tickets found</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2 p-4 pt-0">
                  {filteredTickets.map((ticket) => (
                    <button
                      key={ticket.id}
                      onClick={() => setSelectedTicketId(ticket.id)}
                      className={cn(
                        "flex flex-col items-start gap-2 rounded-lg border p-3 text-left text-sm transition-all hover:bg-accent/70",
                        selectedTicketId === ticket.id && "bg-accent/70"
                      )}
                    >
                      <div className="flex w-full flex-col gap-1">
                        <div className="flex items-center">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">
                              {ticket.conversation?.visitor_name ||
                                ticket.conversation?.visitor_email?.split("@")[0] ||
                                "Unknown"}
                            </span>
                            {ticket.status === "open" && (
                              <span className="flex h-2 w-2 rounded-full bg-blue-600" />
                            )}
                          </div>
                          <span className={cn(
                            "ml-auto text-xs",
                            selectedTicketId === ticket.id ? "text-foreground" : "text-muted-foreground"
                          )}>
                            {formatTimeAgo(ticket.updated_at)}
                          </span>
                        </div>
                        <div className="text-xs font-medium">
                          {ticket.subject || "No subject"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={statusVariants[ticket.status]} className="text-xs">
                          {ticket.status}
                        </Badge>
                        <Badge variant={priorityVariants[ticket.priority]} className="text-xs">
                          {ticket.priority}
                        </Badge>
                        {ticket.tags && ticket.tags.length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {ticket.tags[0]}
                          </Badge>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              </ScrollArea>
              </div>
            </Tabs>
          </ResizablePanel>

          <ResizableHandle hidden={isMobile} withHandle />

          {/* Right - Ticket Detail */}
          <ResizablePanel defaultSize={55} minSize={30} hidden={isMobile}>
            {selectedTicketId ? (
              <div className="flex h-full">
                <TicketDetail
                  ticketId={selectedTicketId}
                  onClose={() => setSelectedTicketId(null)}
                  onTicketUpdated={fetchHelpdeskData}
                />
                <CustomerContext ticketId={selectedTicketId} />
              </div>
            ) : (
              <div className="flex h-full items-center justify-center bg-muted/30">
                <div className="text-center text-muted-foreground">
                  <Inbox className="size-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Select a ticket to view details</p>
                </div>
              </div>
            )}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </TooltipProvider>
  );
}
