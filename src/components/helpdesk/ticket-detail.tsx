"use client";

import { useState, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  X,
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  Tag,
  User,
  Bot,
  Loader2,
  MessageSquare,
} from "lucide-react";
import type {
  TicketStatus,
  TicketPriority,
  HelpdeskTicketWithRelations,
  HelpdeskTag,
} from "@/types/helpdesk";

interface Message {
  id: string;
  role: "user" | "assistant" | "agent";
  content: string;
  created_at: string;
  agent_name?: string;
  is_internal_note?: boolean;
}

interface TicketDetailProps {
  ticketId: string;
  onClose: () => void;
  onTicketUpdated?: () => void;
}

const statusColors: Record<TicketStatus, string> = {
  open: "bg-blue-100 text-blue-700",
  pending: "bg-yellow-100 text-yellow-700",
  snoozed: "bg-purple-100 text-purple-700",
  closed: "bg-slate-100 text-slate-600",
};

const priorityOptions = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export function TicketDetail({
  ticketId,
  onClose,
  onTicketUpdated,
}: TicketDetailProps) {
  const [ticket, setTicket] = useState<HelpdeskTicketWithRelations | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [availableTags, setAvailableTags] = useState<HelpdeskTag[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchTicket();
    fetchTags();
  }, [ticketId]);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchTicket = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/helpdesk/tickets/${ticketId}`);
      if (res.ok) {
        const data = await res.json();
        setTicket(data);
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error("Failed to fetch ticket:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTags = async () => {
    try {
      const res = await fetch("/api/helpdesk/tags");
      if (res.ok) {
        const data = await res.json();
        setAvailableTags(data);
      }
    } catch (error) {
      console.error("Failed to fetch tags:", error);
    }
  };

  const updateTicket = async (updates: Partial<HelpdeskTicketWithRelations>) => {
    try {
      const res = await fetch(`/api/helpdesk/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const updated = await res.json();
        setTicket((prev) => (prev ? { ...prev, ...updated } : null));
        onTicketUpdated?.();
      }
    } catch (error) {
      console.error("Failed to update ticket:", error);
    }
  };

  const sendReply = async () => {
    if (!replyText.trim() || !ticket) return;

    setSending(true);
    try {
      const res = await fetch(`/api/helpdesk/tickets/${ticketId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: replyText,
          is_internal_note: false,
        }),
      });

      if (res.ok) {
        const newMessage = await res.json();
        setMessages((prev) => [...prev, newMessage]);
        setReplyText("");

        // Update ticket to pending if it was open
        if (ticket.status === "open") {
          updateTicket({ status: "pending" });
        }

        // Record first response time if not set
        if (!ticket.first_response_at) {
          updateTicket({ first_response_at: new Date().toISOString() } as any);
        }
      }
    } catch (error) {
      console.error("Failed to send reply:", error);
    } finally {
      setSending(false);
    }
  };

  const closeTicket = () => {
    updateTicket({ status: "closed" });
  };

  const reopenTicket = () => {
    updateTicket({ status: "open" });
  };

  const formatTime = (date: string) => {
    return new Date(date).toLocaleString("en-NZ", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <p className="text-slate-500">Ticket not found</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <Badge className={statusColors[ticket.status]}>{ticket.status}</Badge>
          <span className="font-medium">
            {ticket.conversation?.visitor_name ||
              ticket.conversation?.visitor_email ||
              "Unknown Customer"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={ticket.priority}
            onValueChange={(value) =>
              updateTicket({ priority: value as TicketPriority })
            }
          >
            <SelectTrigger className="w-28 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {priorityOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {ticket.status !== "closed" ? (
                <DropdownMenuItem onClick={closeTicket}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Close Ticket
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={reopenTicket}>
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Reopen Ticket
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Tag className="h-4 w-4 mr-2" />
                Manage Tags
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Clock className="h-4 w-4 mr-2" />
                Snooze
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Subject */}
      {ticket.subject && (
        <div className="px-4 py-2 border-b bg-slate-50">
          <p className="text-sm text-slate-600">
            <strong>Subject:</strong> {ticket.subject}
          </p>
        </div>
      )}

      {/* Tags */}
      {ticket.tags && ticket.tags.length > 0 && (
        <div className="px-4 py-2 border-b flex gap-2 flex-wrap">
          {ticket.tags.map((tag: HelpdeskTag) => (
            <Badge
              key={tag.id}
              variant="outline"
              style={{ borderColor: tag.color, color: tag.color }}
            >
              {tag.name}
            </Badge>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-slate-400 py-8">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No messages yet</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${
                message.role === "user" ? "" : "flex-row-reverse"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  message.role === "user"
                    ? "bg-slate-200"
                    : message.role === "agent"
                    ? "bg-blue-100"
                    : "bg-purple-100"
                }`}
              >
                {message.role === "user" ? (
                  <User className="h-4 w-4 text-slate-600" />
                ) : message.role === "agent" ? (
                  <User className="h-4 w-4 text-blue-600" />
                ) : (
                  <Bot className="h-4 w-4 text-purple-600" />
                )}
              </div>
              <div
                className={`max-w-[70%] ${
                  message.role === "user" ? "" : "text-right"
                }`}
              >
                <div
                  className={`rounded-lg p-3 ${
                    message.role === "user"
                      ? "bg-slate-100"
                      : message.role === "agent"
                      ? "bg-blue-50"
                      : "bg-purple-50"
                  } ${message.is_internal_note ? "border-2 border-yellow-300" : ""}`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {message.role === "agent" && message.agent_name
                    ? `${message.agent_name} • `
                    : message.role === "assistant"
                    ? "AI Bot • "
                    : ""}
                  {formatTime(message.created_at)}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply Composer */}
      {ticket.status !== "closed" && (
        <div className="p-4 border-t">
          <div className="flex gap-2">
            <Textarea
              placeholder="Type your reply..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              className="min-h-[80px] resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  sendReply();
                }
              }}
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-slate-400">Ctrl+Enter to send</p>
            <Button onClick={sendReply} disabled={!replyText.trim() || sending}>
              {sending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send Reply
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
