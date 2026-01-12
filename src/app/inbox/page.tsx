"use client";

import { useState, useEffect, useRef } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Search,
  Send,
  Bot,
  User,
  MoreVertical,
  Phone,
  Mail,
  MapPin,
  Tag,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  UserCircle,
  Paperclip,
  Smile,
  Loader2,
  MessageSquare,
  Inbox as InboxIcon,
  Sparkles,
  UserCheck,
  Bell,
  Monitor,
  ExternalLink,
  Eye,
  Wifi,
} from "lucide-react";
import { useConversations } from "@/hooks/use-conversations";
import { useMessages } from "@/hooks/use-messages";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

type Conversation = Database["public"]["Tables"]["conversations"]["Row"];
type Message = Database["public"]["Tables"]["messages"]["Row"];
type ConversationStatus = "active" | "pending" | "resolved";

type FilterTab = "all" | "pending" | "active" | "resolved";

export default function InboxPage() {
  const {
    conversations,
    loading: conversationsLoading,
    updateStatus,
    assignToAgent,
  } = useConversations();

  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [newTag, setNewTag] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get selected conversation
  const selectedConversation = conversations.find(
    (c) => c.id === selectedConversationId
  );

  // Use messages hook for the selected conversation
  const {
    messages,
    loading: messagesLoading,
    sendMessage,
  } = useMessages(selectedConversationId);

  // Auto-select first conversation when list loads
  useEffect(() => {
    if (!selectedConversationId && conversations.length > 0) {
      setSelectedConversationId(conversations[0].id);
    }
  }, [conversations, selectedConversationId]);

  // Update customer note when conversation changes
  useEffect(() => {
    if (selectedConversation) {
      const metadata = selectedConversation.metadata as { notes?: string } | null;
      setCustomerNote(metadata?.notes || "");
    }
  }, [selectedConversation]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Filter and sort conversations (handoff requests first, then by date)
  const filteredConversations = conversations
    .filter((conv) => {
      const matchesFilter = activeFilter === "all" || conv.status === activeFilter;
      const matchesSearch =
        conv.visitor_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conv.visitor_email?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    })
    .sort((a, b) => {
      // Handoff requested conversations first
      const aHandoff = hasHandoffRequested(a);
      const bHandoff = hasHandoffRequested(b);
      if (aHandoff && !bHandoff) return -1;
      if (!aHandoff && bHandoff) return 1;
      // Then pending conversations
      if (a.status === "pending" && b.status !== "pending") return -1;
      if (a.status !== "pending" && b.status === "pending") return 1;
      // Then by date (newest first)
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

  // Get last message for conversation preview
  const getLastMessage = (conv: Conversation): string => {
    // For now, we'll use a placeholder - in production, you'd denormalize this
    return "Click to view messages...";
  };

  // Format time ago
  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  // Format message time
  const formatMessageTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <Clock className="h-3 w-3" />;
      case "pending":
        return <AlertCircle className="h-3 w-3" />;
      case "resolved":
        return <CheckCircle2 className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "active":
        return "border-green-200 bg-green-50 text-green-700";
      case "pending":
        return "border-orange-200 bg-orange-50 text-orange-700";
      case "resolved":
        return "border-slate-200 bg-slate-50 text-slate-600";
      default:
        return "";
    }
  };

  const handleSelectConversation = (conv: Conversation) => {
    setSelectedConversationId(conv.id);
    const metadata = conv.metadata as { notes?: string } | null;
    setCustomerNote(metadata?.notes || "");
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversationId || sendingMessage) return;

    setSendingMessage(true);
    try {
      await sendMessage(newMessage, "agent", "Admin");
      setNewMessage("");
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message");
    } finally {
      setSendingMessage(false);
    }
  };

  const handleAIRespond = async () => {
    if (!selectedConversationId || generatingAI) return;

    // Get the last visitor message to respond to
    const lastVisitorMessage = [...messages].reverse().find(
      (m) => m.sender_type === "visitor"
    );

    if (!lastVisitorMessage) {
      toast.error("No visitor message to respond to");
      return;
    }

    setGeneratingAI(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId: selectedConversationId,
          message: lastVisitorMessage.content,
          visitorInfo: {
            name: selectedConversation?.visitor_name,
            email: selectedConversation?.visitor_email,
            location: selectedConversation?.visitor_location,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate AI response");
      }

      // The message is saved by the API, and realtime will update the UI
      toast.success("AI response generated");
    } catch (error) {
      console.error("Failed to generate AI response:", error);
      toast.error(error instanceof Error ? error.message : "Failed to generate AI response");
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedConversationId) return;

    try {
      const newStatus = selectedConversation?.status === "resolved" ? "active" : "resolved";
      await updateStatus(selectedConversationId, newStatus as ConversationStatus);
      toast.success(newStatus === "resolved" ? "Conversation resolved" : "Conversation reopened");
    } catch (error) {
      console.error("Failed to update status:", error);
      toast.error("Failed to update conversation");
    }
  };

  const handleTakeOver = async () => {
    if (!selectedConversationId || !selectedConversation) return;

    try {
      // Update conversation status to active and clear handoff flag
      const currentMetadata = selectedConversation.metadata as Record<string, unknown> | null;
      const { error } = await supabase
        .from("conversations")
        .update({
          status: "active",
          assigned_to: "Admin", // In real app, this would be the logged-in user
          metadata: {
            ...currentMetadata,
            handoffRequested: false,
            handoffCompletedBy: "Admin",
            handoffCompletedAt: new Date().toISOString(),
          },
        })
        .eq("id", selectedConversationId);

      if (error) throw error;

      // Add system message that agent has taken over
      await supabase.from("messages").insert({
        conversation_id: selectedConversationId,
        sender_type: "system",
        sender_name: "System",
        content: "An agent has joined the conversation and will assist you from here.",
      });

      toast.success("You've taken over this conversation");
    } catch (error) {
      console.error("Failed to take over conversation:", error);
      toast.error("Failed to take over conversation");
    }
  };

  const handleSaveNote = async () => {
    if (!selectedConversationId) return;

    setSavingNote(true);
    try {
      const currentMetadata = selectedConversation?.metadata as Record<string, unknown> | null;
      const { error } = await supabase
        .from("conversations")
        .update({
          metadata: {
            ...currentMetadata,
            notes: customerNote,
          },
        })
        .eq("id", selectedConversationId);

      if (error) throw error;
      toast.success("Note saved");
    } catch (error) {
      console.error("Failed to save note:", error);
      toast.error("Failed to save note");
    } finally {
      setSavingNote(false);
    }
  };

  const handleAddTag = async () => {
    if (!newTag.trim() || !selectedConversationId) return;

    try {
      const currentMetadata = selectedConversation?.metadata as { tags?: string[] } | null;
      const currentTags = currentMetadata?.tags || [];

      if (currentTags.includes(newTag)) {
        toast.error("Tag already exists");
        return;
      }

      const { error } = await supabase
        .from("conversations")
        .update({
          metadata: {
            ...currentMetadata,
            tags: [...currentTags, newTag],
          },
        })
        .eq("id", selectedConversationId);

      if (error) throw error;
      setNewTag("");
      toast.success("Tag added");
    } catch (error) {
      console.error("Failed to add tag:", error);
      toast.error("Failed to add tag");
    }
  };

  const getInitials = (name: string | null): string => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  const getTags = (conv: Conversation | undefined): string[] => {
    if (!conv) return [];
    const metadata = conv.metadata as { tags?: string[] } | null;
    return metadata?.tags || [];
  };

  // Check if conversation has handoff requested
  const hasHandoffRequested = (conv: Conversation): boolean => {
    const metadata = conv.metadata as { handoffRequested?: boolean } | null;
    return metadata?.handoffRequested === true;
  };

  // Get handoff info
  const getHandoffInfo = (conv: Conversation | undefined): { requested: boolean; time?: string; reason?: string } => {
    if (!conv) return { requested: false };
    const metadata = conv.metadata as {
      handoffRequested?: boolean;
      handoffTime?: string;
      handoffReason?: string;
    } | null;
    return {
      requested: metadata?.handoffRequested === true,
      time: metadata?.handoffTime,
      reason: metadata?.handoffReason,
    };
  };

  // Get visitor info from metadata
  interface VisitorInfo {
    browser?: string;
    os?: string;
    deviceType?: string;
    ip?: string;
    location?: string;
    currentPage?: string;
    pageTitle?: string;
    referrer?: string;
    timezone?: string;
    language?: string;
    screenResolution?: string;
    pagesViewed?: Array<{ url: string; title: string; visitedAt: string }>;
  }

  const getVisitorInfo = (conv: Conversation | undefined): VisitorInfo => {
    if (!conv) return {};
    const metadata = conv.metadata as VisitorInfo | null;
    return metadata || {};
  };

  // Format page URL for display
  const formatPageUrl = (url: string): string => {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname + urlObj.search;
    } catch {
      return url;
    }
  };

  // Format time for page views
  const formatPageViewTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Loading skeleton for conversation list
  const ConversationSkeleton = () => (
    <div className="border-b p-4">
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-5 w-20" />
        </div>
      </div>
    </div>
  );

  // Empty state component
  const EmptyState = () => (
    <div className="flex flex-1 flex-col items-center justify-center bg-slate-50 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
        <InboxIcon className="h-8 w-8 text-slate-400" />
      </div>
      <h3 className="mt-4 text-lg font-medium text-slate-900">No conversations yet</h3>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        When visitors start chatting on your website, their conversations will appear here.
      </p>
    </div>
  );

  // No selection state
  const NoSelectionState = () => (
    <div className="flex flex-1 flex-col items-center justify-center bg-slate-50 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
        <MessageSquare className="h-8 w-8 text-slate-400" />
      </div>
      <h3 className="mt-4 text-lg font-medium text-slate-900">Select a conversation</h3>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        Choose a conversation from the list to view messages.
      </p>
    </div>
  );

  return (
    <div className="flex h-full">
      {/* LEFT: Conversation List */}
      <div className="flex w-80 flex-col border-r bg-white">
        {/* Header */}
        <div className="border-b p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Inbox</h2>
            <Badge className="bg-blue-100 text-blue-700">
              {conversations.filter((c) => c.status === "pending").length} new
            </Badge>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search conversations..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="border-b px-2 py-2">
          <Tabs value={activeFilter} onValueChange={(v) => setActiveFilter(v as FilterTab)}>
            <TabsList className="grid w-full grid-cols-4 bg-slate-100">
              <TabsTrigger value="all" className="text-xs">
                All
              </TabsTrigger>
              <TabsTrigger value="pending" className="text-xs">
                Unassigned
              </TabsTrigger>
              <TabsTrigger value="active" className="text-xs">
                Active
              </TabsTrigger>
              <TabsTrigger value="resolved" className="text-xs">
                Resolved
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Conversation List */}
        <ScrollArea className="flex-1">
          {conversationsLoading ? (
            <>
              <ConversationSkeleton />
              <ConversationSkeleton />
              <ConversationSkeleton />
            </>
          ) : filteredConversations.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              {searchQuery ? "No conversations found" : "No conversations in this category"}
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isHandoff = hasHandoffRequested(conv);
              return (
                <div
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv)}
                  className={`cursor-pointer border-b p-4 transition-colors hover:bg-slate-50 ${
                    selectedConversationId === conv.id
                      ? "border-l-2 border-l-blue-600 bg-blue-50"
                      : isHandoff
                        ? "border-l-2 border-l-orange-500 bg-orange-50"
                        : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="relative">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className={isHandoff ? "bg-orange-100 text-orange-600" : "bg-blue-100 text-blue-600"}>
                          {getInitials(conv.visitor_name)}
                        </AvatarFallback>
                      </Avatar>
                      {isHandoff ? (
                        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-orange-500">
                          <Bell className="h-2.5 w-2.5 text-white" />
                        </span>
                      ) : conv.status === "pending" ? (
                        <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-blue-600" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className={`font-medium ${isHandoff ? "text-orange-900" : conv.status === "pending" ? "text-slate-900" : "text-slate-700"}`}>
                          {conv.visitor_name || "Anonymous"}
                        </p>
                        <span className="text-xs text-slate-400">{formatTimeAgo(conv.updated_at)}</span>
                      </div>
                      <p className="truncate text-sm text-slate-500">{conv.visitor_email || "No email"}</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        {isHandoff && (
                          <Badge className="flex items-center gap-1 text-xs bg-orange-500 text-white hover:bg-orange-600">
                            <Bell className="h-3 w-3" />
                            Handoff
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={`flex items-center gap-1 text-xs ${getStatusStyle(conv.status)}`}
                        >
                          {getStatusIcon(conv.status)}
                          {conv.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </ScrollArea>
      </div>

      {/* CENTER: Chat View */}
      {!selectedConversation && !conversationsLoading ? (
        conversations.length === 0 ? (
          <EmptyState />
        ) : (
          <NoSelectionState />
        )
      ) : (
        <div className="flex flex-1 flex-col">
          {/* Chat Header */}
          {selectedConversation && (
            <div className="flex items-center justify-between border-b bg-white px-6 py-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-blue-100 text-blue-600">
                    {getInitials(selectedConversation.visitor_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-900">
                      {selectedConversation.visitor_name || "Anonymous"}
                    </p>
                    <Badge
                      variant="outline"
                      className={`flex items-center gap-1 text-xs ${getStatusStyle(selectedConversation.status)}`}
                    >
                      {getStatusIcon(selectedConversation.status)}
                      {selectedConversation.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-500">
                    {selectedConversation.visitor_email || "No email provided"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getHandoffInfo(selectedConversation).requested && (
                  <Button
                    size="sm"
                    className="gap-1 bg-orange-500 hover:bg-orange-600"
                    onClick={handleTakeOver}
                  >
                    <UserCheck className="h-4 w-4" />
                    Take Over
                  </Button>
                )}
                <Button variant="outline" size="sm" className="gap-1">
                  <UserCircle className="h-4 w-4" />
                  Assign
                </Button>
                <Button variant="outline" size="sm" onClick={handleResolve}>
                  {selectedConversation.status === "resolved" ? "Reopen" : "Resolve"}
                </Button>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </div>
            </div>
          )}

          {/* Handoff Alert Banner */}
          {selectedConversation && getHandoffInfo(selectedConversation).requested && (
            <div className="flex items-center gap-3 border-b bg-orange-50 px-6 py-3">
              <Bell className="h-5 w-5 text-orange-500" />
              <div className="flex-1">
                <p className="text-sm font-medium text-orange-800">
                  Human handoff requested
                </p>
                <p className="text-xs text-orange-600">
                  Visitor is waiting for a human agent to take over the conversation.
                </p>
              </div>
            </div>
          )}

          {/* Messages */}
          <ScrollArea className="flex-1 bg-slate-50 p-6">
            <div className="mx-auto max-w-2xl space-y-4">
              {messagesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              ) : messages.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-500">
                  No messages yet
                </div>
              ) : (
                messages.map((message) => {
                  // System messages are centered
                  if (message.sender_type === "system") {
                    return (
                      <div key={message.id} className="flex justify-center">
                        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
                          <AlertCircle className="h-4 w-4" />
                          <span>{message.content}</span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={message.id}
                      className={`flex items-start gap-3 ${
                        message.sender_type === "visitor" ? "" : "flex-row-reverse"
                      }`}
                    >
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback
                          className={
                            message.sender_type === "visitor"
                              ? "bg-blue-100 text-blue-600"
                              : message.sender_type === "ai"
                                ? "bg-purple-100 text-purple-600"
                                : "bg-green-100 text-green-600"
                          }
                        >
                          {message.sender_type === "visitor" ? (
                            <User className="h-4 w-4" />
                          ) : message.sender_type === "ai" ? (
                            <Bot className="h-4 w-4" />
                          ) : (
                            "A"
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <div className={`max-w-md ${message.sender_type === "visitor" ? "" : "text-right"}`}>
                        <div
                          className={`mb-1 flex items-center gap-2 text-xs ${
                            message.sender_type === "visitor" ? "" : "flex-row-reverse"
                          }`}
                        >
                          <span className="font-medium text-slate-700">
                            {message.sender_name || message.sender_type}
                          </span>
                          <span className="text-slate-400">{formatMessageTime(message.created_at)}</span>
                        </div>
                        <div
                          className={`rounded-lg p-3 text-left ${
                            message.sender_type === "visitor"
                              ? "bg-white text-slate-900 shadow-sm"
                              : message.sender_type === "ai"
                                ? "bg-purple-600 text-white"
                                : "bg-blue-600 text-white"
                          }`}
                        >
                          <p className="whitespace-pre-line text-sm">{message.content}</p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              {/* AI Typing Indicator */}
              {generatingAI && (
                <div className="flex items-start gap-3 flex-row-reverse">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-purple-100 text-purple-600">
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="max-w-md text-right">
                    <div className="mb-1 flex items-center gap-2 flex-row-reverse text-xs">
                      <span className="font-medium text-slate-700">AI Assistant</span>
                      <span className="text-slate-400">typing...</span>
                    </div>
                    <div className="rounded-lg bg-purple-600 p-3 text-left">
                      <div className="flex items-center gap-1">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-white/70" style={{ animationDelay: "0ms" }} />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-white/70" style={{ animationDelay: "150ms" }} />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-white/70" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Message Input */}
          {selectedConversation && (
            <div className="border-t bg-white p-4">
              <div className="mx-auto max-w-2xl">
                <div className="flex items-end gap-2">
                  <div className="flex-1 rounded-lg border bg-white p-2">
                    <Textarea
                      placeholder="Type your message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      className="min-h-[60px] resize-none border-0 p-0 focus-visible:ring-0"
                      rows={2}
                    />
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Paperclip className="h-4 w-4 text-slate-400" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Smile className="h-4 w-4 text-slate-400" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">Responding as Admin</span>
                        <Button
                          variant="outline"
                          className="gap-2 border-purple-200 text-purple-600 hover:bg-purple-50 hover:text-purple-700"
                          onClick={handleAIRespond}
                          disabled={generatingAI || messages.length === 0}
                        >
                          {generatingAI ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                          AI Respond
                        </Button>
                        <Button
                          className="gap-2 bg-blue-600 hover:bg-blue-700"
                          onClick={handleSendMessage}
                          disabled={sendingMessage || !newMessage.trim()}
                        >
                          {sendingMessage ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                          Send
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* RIGHT: Customer Details Panel */}
      {selectedConversation && (
        <div className="flex w-80 flex-col border-l bg-white">
          {/* Tabs Header */}
          <Tabs defaultValue="info" className="flex flex-1 flex-col">
            <div className="border-b px-4">
              <TabsList className="w-full justify-start gap-4 bg-transparent h-12">
                <TabsTrigger value="info" className="px-0 pb-3 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none">
                  Info
                </TabsTrigger>
                <TabsTrigger value="pages" className="px-0 pb-3 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none">
                  Viewed pages
                </TabsTrigger>
                <TabsTrigger value="notes" className="px-0 pb-3 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none">
                  Notes
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Info Tab */}
            <TabsContent value="info" className="m-0 flex-1 overflow-hidden">
              <ScrollArea className="h-full p-4">
                {/* Customer Data Section */}
                <div className="mb-6">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Customer Data
                  </h3>
                  <div className="space-y-3">
                    {/* Email */}
                    <div className="flex items-start gap-3">
                      <Mail className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-slate-900">
                          {selectedConversation.visitor_email || "Not provided"}
                        </span>
                      </div>
                      {selectedConversation.visitor_email && (
                        <Badge variant="outline" className="flex-shrink-0 text-xs text-green-600 border-green-200 bg-green-50">
                          Subscribed
                        </Badge>
                      )}
                    </div>

                    {/* Location */}
                    <div className="flex items-start gap-3">
                      <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
                      <div className="min-w-0 flex-1">
                        <span className="block text-sm text-slate-900">
                          {getVisitorInfo(selectedConversation).location || selectedConversation.visitor_location || "Unknown"}
                        </span>
                      </div>
                      {getVisitorInfo(selectedConversation).location && (
                        <Badge variant="outline" className="flex-shrink-0 text-xs text-green-600 border-green-200 bg-green-50">
                          <span className="mr-1">&#127757;</span>
                        </Badge>
                      )}
                    </div>

                    {/* Phone */}
                    <div className="flex items-start gap-3">
                      <Phone className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
                      <span className="text-sm text-slate-500">
                        {selectedConversation.visitor_phone || "Phone..."}
                      </span>
                    </div>

                    {/* Browser/OS */}
                    <div className="flex items-start gap-3">
                      <Monitor className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
                      <div className="min-w-0 flex-1">
                        <span className="block text-sm text-slate-900">
                          {getVisitorInfo(selectedConversation).browser || "Unknown"}, {getVisitorInfo(selectedConversation).os || "Unknown"}
                        </span>
                      </div>
                      <Badge variant="outline" className="flex-shrink-0 text-xs text-green-600 border-green-200 bg-green-50">
                        <span className="mr-1">&#127760;</span>
                      </Badge>
                    </div>

                    {/* IP Address */}
                    <div className="flex items-start gap-3">
                      <Wifi className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
                      <span className="text-sm text-slate-900">
                        {getVisitorInfo(selectedConversation).ip || "Unknown"}
                      </span>
                      <Badge variant="outline" className="flex-shrink-0 text-xs text-green-600 border-green-200 bg-green-50">
                        <span className="mr-1">&#127760;</span>
                      </Badge>
                    </div>
                  </div>
                </div>

                <Separator className="my-4" />

                {/* Tags Section */}
                <div className="mb-6">
                  <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    <Tag className="h-3 w-3" />
                    Add a customer tag...
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {getTags(selectedConversation).map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Input
                      placeholder="Add tag..."
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                      className="h-8 text-xs"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1 px-2 text-xs text-slate-500"
                      onClick={handleAddTag}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <Separator className="my-4" />

                {/* Last Viewed Page Section */}
                <div className="mb-6">
                  <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    <Eye className="h-3 w-3" />
                    Last Viewed Page
                  </h3>
                  {getVisitorInfo(selectedConversation).currentPage ? (
                    <div className="rounded-lg border bg-slate-50 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-slate-500">
                            {formatPageViewTime(getVisitorInfo(selectedConversation).pagesViewed?.slice(-1)[0]?.visitedAt || new Date().toISOString())}
                          </p>
                          <a
                            href={getVisitorInfo(selectedConversation).currentPage}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 flex items-center gap-1 text-sm text-blue-600 hover:underline"
                          >
                            <span className="truncate">{formatPageUrl(getVisitorInfo(selectedConversation).currentPage || "")}</span>
                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                          </a>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No page data available</p>
                  )}
                </div>

                {/* See History Link */}
                <button className="flex items-center gap-1 text-sm text-blue-600 hover:underline">
                  <Clock className="h-4 w-4" />
                  See the history
                </button>
              </ScrollArea>
            </TabsContent>

            {/* Viewed Pages Tab */}
            <TabsContent value="pages" className="m-0 flex-1 overflow-hidden">
              <ScrollArea className="h-full p-4">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Page History
                </h3>
                {getVisitorInfo(selectedConversation).pagesViewed && getVisitorInfo(selectedConversation).pagesViewed!.length > 0 ? (
                  <div className="space-y-3">
                    {getVisitorInfo(selectedConversation).pagesViewed!.slice().reverse().map((page, index) => (
                      <div key={index} className="rounded-lg border bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">{formatPageViewTime(page.visitedAt)}</p>
                        <p className="mt-1 text-sm font-medium text-slate-900 truncate">{page.title || "Untitled"}</p>
                        <a
                          href={page.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 flex items-center gap-1 text-xs text-blue-600 hover:underline"
                        >
                          <span className="truncate">{formatPageUrl(page.url)}</span>
                          <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No pages viewed yet</p>
                )}
              </ScrollArea>
            </TabsContent>

            {/* Notes Tab */}
            <TabsContent value="notes" className="m-0 flex-1 overflow-hidden">
              <ScrollArea className="h-full p-4">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Internal Notes
                </h3>
                <Textarea
                  placeholder="Add notes about this customer..."
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                  className="min-h-[120px] resize-none text-sm"
                  rows={5}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={handleSaveNote}
                  disabled={savingNote}
                >
                  {savingNote ? (
                    <>
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Notes"
                  )}
                </Button>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
