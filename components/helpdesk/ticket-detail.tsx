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
  Reply,
  Forward,
  Archive,
  Trash2,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type {
  TicketStatus,
  TicketPriority,
  HelpdeskTicketWithRelations,
  HelpdeskTag,
} from "@/types/helpdesk";

interface Message {
  id: string;
  sender_type: "visitor" | "ai" | "agent" | "system";
  sender_name: string;
  content: string;
  created_at: string;
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
    <div className="flex-1 flex flex-col">
      {/* Action Bar - Like Mail app */}
      <div className="flex items-center gap-2 p-2">
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={ticket.status !== "closed" ? closeTicket : reopenTicket}
              >
                {ticket.status !== "closed" ? <Archive /> : <AlertCircle />}
                <span className="sr-only">
                  {ticket.status !== "closed" ? "Close Ticket" : "Reopen Ticket"}
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {ticket.status !== "closed" ? "Close Ticket" : "Reopen Ticket"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon">
                <Trash2 />
                <span className="sr-only">Delete</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete</TooltipContent>
          </Tooltip>
        </div>

        <Separator orientation="vertical" className="h-4" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon">
              <Clock />
              <span className="sr-only">Snooze</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Snooze</TooltipContent>
        </Tooltip>

        <div className="ml-auto flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon">
                <Reply />
                <span className="sr-only">Reply</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reply</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon">
                <Forward />
                <span className="sr-only">Forward</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Forward</TooltipContent>
          </Tooltip>
        </div>

        <Separator orientation="vertical" className="h-4" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical />
              <span className="sr-only">More</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>
              <Tag className="h-4 w-4 mr-2" />
              Manage Tags
            </DropdownMenuItem>
            <DropdownMenuItem>
              <User className="h-4 w-4 mr-2" />
              Assign to Agent
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onClose}>
              <X className="h-4 w-4 mr-2" />
              Close Panel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Separator />

      {/* Customer Info Header */}
      <div className="flex items-start p-4">
        <div className="flex items-start gap-4 text-sm">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div className="grid gap-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold">
                {ticket.conversation?.visitor_name ||
                  ticket.conversation?.visitor_email ||
                  "Unknown Customer"}
              </span>
              <Badge className={statusColors[ticket.status]}>{ticket.status}</Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              {ticket.subject || "No subject"}
            </div>
            {ticket.conversation?.visitor_email && (
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">Email:</span> {ticket.conversation.visitor_email}
              </div>
            )}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
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
        </div>
      </div>

      <Separator />

      {/* Tags */}
      {ticket.tags && ticket.tags.length > 0 && (
        <>
          <div className="px-4 py-2 flex gap-2 flex-wrap">
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
          <Separator />
        </>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-slate-400 py-8">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No messages yet</p>
          </div>
        ) : (
          messages.map((message) => {
            const isCustomer = message.sender_type === "visitor";
            const isAgent = message.sender_type === "agent";
            const isAI = message.sender_type === "ai";
            const isSystem = message.sender_type === "system";

            // System messages centered
            if (isSystem) {
              return (
                <div key={message.id} className="flex justify-center">
                  <div className="bg-slate-100 text-slate-500 text-xs px-3 py-1 rounded-full">
                    {message.content}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={message.id}
                className={`flex gap-3 ${isCustomer ? "justify-end" : "justify-start"}`}
              >
                {/* Avatar on left for AI/Agent */}
                {!isCustomer && (
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      isAgent ? "bg-blue-100" : "bg-slate-200"
                    }`}
                  >
                    {isAgent ? (
                      <User className="h-4 w-4 text-blue-600" />
                    ) : (
                      <Bot className="h-4 w-4 text-slate-600" />
                    )}
                  </div>
                )}

                <div className={`max-w-[70%] ${isCustomer ? "text-right" : "text-left"}`}>
                  <div
                    className={`rounded-lg p-3 ${
                      isCustomer
                        ? "bg-blue-500 text-white"
                        : isAgent
                        ? "bg-blue-50"
                        : "bg-slate-100"
                    } ${message.is_internal_note ? "border-2 border-yellow-300" : ""}`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {isAgent && message.sender_name
                      ? `${message.sender_name} • `
                      : isAI
                      ? `${message.sender_name || "AI Bot"} • `
                      : ""}
                    {formatTime(message.created_at)}
                  </p>
                </div>

                {/* Avatar on right for Customer */}
                {isCustomer && (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-blue-500">
                    <User className="h-4 w-4 text-white" />
                  </div>
                )}
              </div>
            );
          })
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
