"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Inbox,
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Settings,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { TicketDetail } from "@/components/helpdesk/ticket-detail";
import { CustomerContext } from "@/components/helpdesk/customer-context";
import type {
  TicketStatus,
  HelpdeskTicketWithRelations,
  TicketStats,
} from "@/types/helpdesk";

// Status badge colors
const statusColors: Record<TicketStatus, string> = {
  open: "bg-blue-100 text-blue-700 border-blue-200",
  pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
  snoozed: "bg-purple-100 text-purple-700 border-purple-200",
  closed: "bg-slate-100 text-slate-600 border-slate-200",
};

const priorityColors = {
  low: "bg-slate-100 text-slate-600",
  normal: "bg-blue-100 text-blue-600",
  high: "bg-orange-100 text-orange-600",
  urgent: "bg-red-100 text-red-600",
};

export default function HelpdeskPage() {
  const [tickets, setTickets] = useState<HelpdeskTicketWithRelations[]>([]);
  const [stats, setStats] = useState<TicketStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [searchQuery, setSearchQuery] = useState("");
  const [helpdeskEnabled, setHelpdeskEnabled] = useState<boolean | null>(null);

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

  // Show setup screen if helpdesk not enabled
  if (helpdeskEnabled === false) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50">
        <div className="text-center max-w-md">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Inbox className="h-8 w-8 text-blue-600" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            Helpdesk Module
          </h2>
          <p className="text-slate-500 mb-6">
            The helpdesk module provides a unified inbox for managing customer
            conversations that require human attention. Enable it to start
            handling support tickets.
          </p>
          <Link href="/settings/helpdesk">
            <Button>
              <Settings className="h-4 w-4 mr-2" />
              Enable Helpdesk
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Left Sidebar - Status Filters & Stats */}
      <div className="w-56 border-r bg-white flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-lg font-semibold">Helpdesk</h1>
        </div>

        {/* Quick Stats */}
        {stats && (
          <div className="p-3 border-b space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Open</span>
              <Badge variant="secondary">{stats.open}</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Pending</span>
              <Badge variant="secondary">{stats.pending}</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Snoozed</span>
              <Badge variant="secondary">{stats.snoozed}</Badge>
            </div>
          </div>
        )}

        {/* Status Filters */}
        <nav className="flex-1 p-2 space-y-1">
          {[
            { value: "open", label: "Open", icon: AlertCircle },
            { value: "pending", label: "Pending", icon: Clock },
            { value: "snoozed", label: "Snoozed", icon: Clock },
            { value: "closed", label: "Closed", icon: CheckCircle2 },
            { value: "all", label: "All Tickets", icon: Inbox },
          ].map((item) => (
            <button
              key={item.value}
              onClick={() => setStatusFilter(item.value)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                statusFilter === item.value
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </nav>

        {/* Settings Link */}
        <div className="p-3 border-t">
          <Link href="/settings/helpdesk">
            <Button variant="ghost" size="sm" className="w-full justify-start">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </Link>
        </div>
      </div>

      {/* Middle - Ticket List */}
      <div className="w-80 border-r bg-white flex flex-col">
        {/* Search & Filters */}
        <div className="p-3 border-b space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search tickets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Select defaultValue="newest">
              <SelectTrigger className="flex-1 h-8 text-xs">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
                <SelectItem value="priority">Priority</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchHelpdeskData}
              className="h-8 px-2"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Ticket List */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400">
              <Inbox className="h-8 w-8 mb-2" />
              <p className="text-sm">No tickets found</p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredTickets.map((ticket) => (
                <button
                  key={ticket.id}
                  onClick={() => setSelectedTicketId(ticket.id)}
                  className={`w-full p-3 text-left hover:bg-slate-50 transition-colors ${
                    selectedTicketId === ticket.id ? "bg-blue-50" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="font-medium text-sm truncate">
                      {ticket.conversation?.visitor_name ||
                        ticket.conversation?.visitor_email ||
                        "Unknown"}
                    </span>
                    <span className="text-xs text-slate-400 shrink-0">
                      {formatTimeAgo(ticket.updated_at)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 truncate mb-2">
                    {ticket.subject || "No subject"}
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`text-xs ${statusColors[ticket.status]}`}
                    >
                      {ticket.status}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className={`text-xs ${priorityColors[ticket.priority]}`}
                    >
                      {ticket.priority}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right - Ticket Detail + Customer Context */}
      {selectedTicketId ? (
        <>
          <TicketDetail
            ticketId={selectedTicketId}
            onClose={() => setSelectedTicketId(null)}
            onTicketUpdated={fetchHelpdeskData}
          />
          <CustomerContext ticketId={selectedTicketId} />
        </>
      ) : (
        <div className="flex-1 bg-slate-50 flex items-center justify-center">
          <div className="text-center text-slate-400">
            <Inbox className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Select a ticket to view details</p>
          </div>
        </div>
      )}
    </div>
  );
}
