"use client";

import { useState, useEffect, useRef } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
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
  Star,
  Users,
  ChevronDown,
  Archive,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConversations } from "@/hooks/use-conversations";
import { useMessages } from "@/hooks/use-messages";
import { supabase } from "@/lib/supabase"; // Only used for realtime typing subscription
import { useAgent } from "@/contexts/AgentContext";
import type { Database } from "@/types/database";

type Conversation = Database["public"]["Tables"]["conversations"]["Row"];
type Message = Database["public"]["Tables"]["messages"]["Row"];
type ConversationStatus = "active" | "pending" | "resolved";

// Task 046: Extended filters for assignment
type FilterTab = "all" | "mine" | "unassigned" | "pending" | "active" | "resolved";

// Task 046: Agent type for assignment dropdown
interface Agent {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  role: "owner" | "admin" | "agent";
  is_online: boolean;
}

export default function InboxPage() {
  const {
    conversations,
    loading: conversationsLoading,
    refetch,
    updateStatus,
    assignToAgent,
  } = useConversations();

  // Task 046: Get current agent for "My Chats" filter
  const { agent: currentAgent } = useAgent();
  const isMobile = useIsMobile();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [newTag, setNewTag] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"info" | "pages" | "notes">("info");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Task 046: Agents list for assignment dropdown
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);

  // Task 046: Load agents for assignment dropdown
  useEffect(() => {
    const loadAgents = async () => {
      setLoadingAgents(true);
      try {
        const res = await fetch("/api/agents");
        if (res.ok) {
          const data = await res.json();
          setAgents(data.agents || data || []);
        }
      } catch (err) {
        console.error("Failed to load agents:", err);
      }
      setLoadingAgents(false);
    };
    loadAgents();
  }, []);

  // Typing indicator state
  const [visitorTyping, setVisitorTyping] = useState<Record<string, boolean>>({});
  const agentTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Subscribe to typing status changes
  useEffect(() => {
    const channel = supabase
      .channel('typing-status')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'typing_status'
      }, (payload) => {
        const data = payload.new as { conversation_id: string; is_visitor_typing: boolean } | null;
        if (data) {
          setVisitorTyping(prev => ({
            ...prev,
            [data.conversation_id]: data.is_visitor_typing
          }));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Send agent typing status
  const sendAgentTypingStatus = async (isTyping: boolean) => {
    if (!selectedConversationId) return;

    try {
      await fetch(`/api/widget/conversations/${selectedConversationId}/typing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isTyping, sender: 'agent' })
      });
    } catch (error) {
      console.error('Failed to send agent typing status:', error);
    }
  };

  // Handle agent typing
  const handleAgentTyping = () => {
    sendAgentTypingStatus(true);

    // Clear previous timeout
    if (agentTypingTimeoutRef.current) {
      clearTimeout(agentTypingTimeoutRef.current);
    }

    // Set typing = false after 3 seconds
    agentTypingTimeoutRef.current = setTimeout(() => {
      sendAgentTypingStatus(false);
    }, 3000);
  };

  // Task 046: Filter and sort conversations (handoff requests first, then by date)
  const filteredConversations = conversations
    .filter((conv) => {
      // Status-based filters
      let matchesFilter = false;
      if (activeFilter === "all") {
        matchesFilter = true;
      } else if (activeFilter === "mine") {
        // Show only chats assigned to current user
        matchesFilter = conv.assigned_to === currentAgent?.id;
      } else if (activeFilter === "unassigned") {
        // Show only chats with no assignment
        matchesFilter = !conv.assigned_to && conv.status !== "resolved";
      } else {
        // Status filters (pending, active, resolved)
        matchesFilter = conv.status === activeFilter;
      }

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

    // Clear agent typing status
    sendAgentTypingStatus(false);
    if (agentTypingTimeoutRef.current) {
      clearTimeout(agentTypingTimeoutRef.current);
    }

    setSendingMessage(true);
    try {
      await sendMessage(newMessage, "agent", currentAgent?.name || "Admin");
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

  const handleDelete = async () => {
    if (!selectedConversationId) return;
    const name = selectedConversation?.visitor_name || "this visitor";
    if (!window.confirm(`Delete conversation with ${name}? This will permanently remove all messages.`)) return;

    try {
      const res = await fetch(`/api/conversations?id=${selectedConversationId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Conversation deleted");
      setSelectedConversationId(null);
      refetch();
    } catch (error) {
      console.error("Failed to delete conversation:", error);
      toast.error("Failed to delete conversation");
    }
  };

  const handleTakeOver = async () => {
    if (!selectedConversationId || !selectedConversation) return;

    try {
      // Update conversation status to active and clear handoff flag
      const currentMetadata = selectedConversation.metadata as Record<string, unknown> | null;
      const res = await fetch("/api/conversations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedConversationId,
          status: "active",
          assigned_to: currentAgent?.id || null,
          metadata: {
            ...currentMetadata,
            handoffRequested: false,
            handoffCompletedBy: currentAgent?.name || "Admin",
            handoffCompletedAt: new Date().toISOString(),
          },
        }),
      });
      if (!res.ok) throw new Error("Failed to update conversation");

      // Add system message that agent has taken over
      await fetch(`/api/conversations/${selectedConversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `${currentAgent?.name || "An agent"} has joined the conversation and will assist you from here.`,
          senderType: "system",
          senderName: "System",
        }),
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
      const res = await fetch("/api/conversations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedConversationId,
          metadata: {
            ...currentMetadata,
            notes: customerNote,
          },
        }),
      });
      if (!res.ok) throw new Error("Failed to save note");
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

      const res = await fetch("/api/conversations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedConversationId,
          metadata: {
            ...currentMetadata,
            tags: [...currentTags, newTag],
          },
        }),
      });
      if (!res.ok) throw new Error("Failed to add tag");
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

  // Task 046: Handle assigning conversation to agent
  const handleAssign = async (agentId: string | null) => {
    if (!selectedConversationId) return;

    try {
      await assignToAgent(selectedConversationId, agentId);
      const agentName = agentId ? agents.find((a) => a.id === agentId)?.name : null;
      toast.success(agentId ? `Assigned to ${agentName}` : "Unassigned");
    } catch (error) {
      console.error("Failed to assign conversation:", error);
      toast.error("Failed to assign conversation");
    }
  };

  // Task 046: Get assigned agent info
  const getAssignedAgent = (conv: Conversation): Agent | undefined => {
    if (!conv.assigned_to) return undefined;
    return agents.find((a) => a.id === conv.assigned_to);
  };

  const getTags = (conv: Conversation | undefined): string[] => {
    if (!conv) return [];
    const metadata = conv.metadata as { tags?: string[] } | null;
    return metadata?.tags || [];
  };

  // Check if conversation has handoff requested
  function hasHandoffRequested(conv: Conversation): boolean {
    const metadata = conv.metadata as { handoffRequested?: boolean } | null;
    return metadata?.handoffRequested === true;
  }

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

  // Get prechat form data from conversation
  const getPrechatData = (conv: Conversation | undefined): Record<string, unknown> | null => {
    if (!conv) return null;
    // Access prechat_data directly from conversation (added by migration)
    const prechatData = (conv as unknown as { prechat_data?: Record<string, unknown> }).prechat_data;
    return prechatData && Object.keys(prechatData).length > 0 ? prechatData : null;
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

  // Filter counts for tabs
  const filterCounts: Record<FilterTab, number> = {
    all: conversations.length,
    mine: conversations.filter((c) => c.assigned_to === currentAgent?.id).length,
    unassigned: conversations.filter((c) => !c.assigned_to && c.status !== "resolved").length,
    pending: conversations.filter((c) => c.status === "pending").length,
    active: conversations.filter((c) => c.status === "active").length,
    resolved: conversations.filter((c) => c.status === "resolved").length,
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div className="h-[calc(100vh-var(--header-height)-3rem)] rounded-md border">
        <ResizablePanelGroup direction="horizontal" className="items-stretch">
          {/* LEFT: Conversation List */}
          <ResizablePanel defaultSize={25} minSize={20} maxSize={35}>
            <Tabs
              defaultValue="all"
              className="flex h-full flex-col gap-0"
              onValueChange={(value) => setActiveFilter(value as FilterTab)}
            >
              {/* Header */}
              <div className="flex h-[52px] items-center px-4">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold">Inbox</h1>
                  <Badge className="bg-blue-100 text-blue-700">
                    {filterCounts.pending} new
                  </Badge>
                </div>
                <TabsList className="ml-auto">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="unassigned">
                    Unassigned
                    {filterCounts.unassigned > 0 && (
                      <span className="ml-1 text-xs">{filterCounts.unassigned}</span>
                    )}
                  </TabsTrigger>
                </TabsList>
              </div>
              <Separator />

              {/* Search */}
              <div className="bg-background/95 supports-[backdrop-filter]:bg-background/60 p-4 backdrop-blur">
                <form>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      placeholder="Search conversations..."
                      className="pl-8"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </form>
              </div>

              {/* Secondary Filter Tabs */}
              <div className="px-4 pb-2">
                <div className="flex flex-wrap gap-1">
                  {(["all", "mine", "active", "resolved"] as const).map((filter) => {
                    const filterLabels: Record<FilterTab, string> = {
                      all: "All",
                      mine: "My Chats",
                      unassigned: "Unassigned",
                      pending: "Pending",
                      active: "Active",
                      resolved: "Resolved",
                    };
                    return (
                      <button
                        key={filter}
                        onClick={() => setActiveFilter(filter)}
                        className={cn(
                          "text-xs py-1 px-2 rounded-md font-medium transition-colors",
                          activeFilter === filter
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        {filterLabels[filter]}
                        {filter !== "all" && filterCounts[filter] > 0 && (
                          <span className="ml-1">{filterCounts[filter]}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Conversation List */}
              <div className="min-h-0">
              <ScrollArea className="h-full">
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
              const assignedAgent = getAssignedAgent(conv);
              return (
                <button
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv)}
                  className={cn(
                    "flex flex-col items-start gap-2 rounded-lg border p-3 text-left text-sm transition-all hover:bg-accent/70 w-full",
                    selectedConversationId === conv.id && "bg-accent/70",
                    isHandoff && "border-l-2 border-l-orange-500"
                  )}
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
                      <div className="mt-1.5 flex items-center gap-2 flex-wrap">
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
                        {/* Task 046: Show assigned agent */}
                        {assignedAgent && (
                          <Badge
                            variant="outline"
                            className="flex items-center gap-1 text-xs border-green-200 bg-green-50 text-green-700"
                          >
                            <UserCircle className="h-3 w-3" />
                            {assignedAgent.name.split(" ")[0]}
                          </Badge>
                        )}
                        {conv.rating && (
                          <div className="flex items-center gap-0.5 text-amber-500" title={`Rated ${conv.rating}/5`}>
                            <Star className="h-3 w-3 fill-current" />
                            <span className="text-xs font-medium">{conv.rating}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
              </ScrollArea>
              </div>
            </Tabs>
          </ResizablePanel>

          <ResizableHandle hidden={isMobile} withHandle />

          {/* CENTER: Chat View */}
          <ResizablePanel defaultSize={50} minSize={30}>
      {!selectedConversation && !conversationsLoading ? (
        conversations.length === 0 ? (
          <EmptyState />
        ) : (
          <NoSelectionState />
        )
      ) : (
        <div className="flex h-full flex-col overflow-hidden">
          {/* Action Bar - Like Mail app */}
          {selectedConversation && (
            <div className="flex h-[52px] items-center gap-2 px-2">
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleResolve}
                    >
                      {selectedConversation.status === "resolved" ? <AlertCircle /> : <Archive />}
                      <span className="sr-only">
                        {selectedConversation.status === "resolved" ? "Reopen" : "Resolve"}
                      </span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {selectedConversation.status === "resolved" ? "Reopen Conversation" : "Resolve Conversation"}
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={handleDelete}>
                      <Trash2 />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete</TooltipContent>
                </Tooltip>
              </div>

              <div className="ml-auto">
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
                    View Customer
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          <Separator />

          {/* Chat Header */}
          {selectedConversation && (
            <div className="flex items-start p-4">
              <div className="flex items-start gap-4 text-sm">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-blue-100 text-blue-600">
                    {getInitials(selectedConversation.visitor_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">
                      {selectedConversation.visitor_name || "Anonymous"}
                    </span>
                    <Badge
                      variant="outline"
                      className={`flex items-center gap-1 text-xs ${getStatusStyle(selectedConversation.status)}`}
                    >
                      {getStatusIcon(selectedConversation.status)}
                      {selectedConversation.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {selectedConversation.visitor_email || "No email provided"}
                  </div>
                </div>
              </div>
              <div className="ml-auto flex items-center gap-2">
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
                {/* Task 046: Assignment dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1">
                      {selectedConversation.assigned_to ? (
                        <>
                          <UserCheck className="h-4 w-4 text-green-600" />
                          {getAssignedAgent(selectedConversation)?.name.split(" ")[0] || "Assigned"}
                        </>
                      ) : (
                        <>
                          <UserCircle className="h-4 w-4" />
                          Assign
                        </>
                      )}
                      <ChevronDown className="h-3 w-3 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Assign to</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {loadingAgents ? (
                      <div className="flex items-center justify-center py-2">
                        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                      </div>
                    ) : (
                      <>
                        {/* Assign to me option */}
                        {currentAgent && (
                          <DropdownMenuItem
                            onClick={() => handleAssign(currentAgent.id)}
                            className={selectedConversation.assigned_to === currentAgent.id ? "bg-green-50" : ""}
                          >
                            <div className="flex items-center gap-2 w-full">
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-xs bg-blue-100 text-blue-600">
                                  {getInitials(currentAgent.name)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="flex-1">{currentAgent.name} (me)</span>
                              {selectedConversation.assigned_to === currentAgent.id && (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              )}
                            </div>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        {/* Other agents */}
                        {agents
                          .filter((a) => a.id !== currentAgent?.id)
                          .map((agent) => (
                            <DropdownMenuItem
                              key={agent.id}
                              onClick={() => handleAssign(agent.id)}
                              className={selectedConversation.assigned_to === agent.id ? "bg-green-50" : ""}
                            >
                              <div className="flex items-center gap-2 w-full">
                                <Avatar className="h-6 w-6">
                                  <AvatarFallback className="text-xs bg-slate-100 text-slate-600">
                                    {getInitials(agent.name)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="flex-1">{agent.name}</span>
                                {agent.is_online && (
                                  <span className="h-2 w-2 rounded-full bg-green-500" />
                                )}
                                {selectedConversation.assigned_to === agent.id && (
                                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                                )}
                              </div>
                            </DropdownMenuItem>
                          ))}
                        {/* Unassign option */}
                        {selectedConversation.assigned_to && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleAssign(null)}
                              className="text-slate-500"
                            >
                              <Users className="h-4 w-4 mr-2" />
                              Unassign
                            </DropdownMenuItem>
                          </>
                        )}
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )}

          <Separator />

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
          <div className="flex-1 min-h-0">
          <ScrollArea className="h-full bg-slate-50 p-6">
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
                          <p className="whitespace-pre-line text-sm">
                            {message.content.split(/(https?:\/\/[^\s,)]+)/g).map((part, i) =>
                              /^https?:\/\//.test(part) ? (
                                <a
                                  key={i}
                                  href={part}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`underline break-all ${
                                    message.sender_type === "visitor"
                                      ? "text-blue-600"
                                      : "text-white/90 hover:text-white"
                                  }`}
                                >
                                  {part}
                                </a>
                              ) : (
                                <span key={i}>{part}</span>
                              )
                            )}
                          </p>
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
          </div>

          {/* Visitor Typing Indicator */}
          {selectedConversation && visitorTyping[selectedConversation.id] && (
            <div className="border-t bg-slate-50 px-4 py-2">
              <div className="mx-auto max-w-2xl">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <div className="flex gap-1">
                    <span className="animate-bounce h-1.5 w-1.5 rounded-full bg-slate-400" style={{ animationDelay: '0ms' }}></span>
                    <span className="animate-bounce h-1.5 w-1.5 rounded-full bg-slate-400" style={{ animationDelay: '150ms' }}></span>
                    <span className="animate-bounce h-1.5 w-1.5 rounded-full bg-slate-400" style={{ animationDelay: '300ms' }}></span>
                  </div>
                  <span>Visitor is typing...</span>
                </div>
              </div>
            </div>
          )}

          {/* Message Input */}
          {selectedConversation && (
            <div className="border-t bg-white p-4">
              <div className="mx-auto max-w-2xl">
                <div className="flex items-end gap-2">
                  <div className="flex-1 rounded-lg border bg-white p-2">
                    <Textarea
                      placeholder="Type your message..."
                      value={newMessage}
                      onChange={(e) => {
                        setNewMessage(e.target.value);
                        if (e.target.value.trim()) {
                          handleAgentTyping();
                        }
                      }}
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
                        <span className="text-xs text-slate-400">Responding as {currentAgent?.name || "Admin"}</span>
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
          </ResizablePanel>

          <ResizableHandle hidden={isMobile} withHandle />

          {/* RIGHT: Customer Details Panel */}
          <ResizablePanel defaultSize={25} minSize={20} maxSize={35} hidden={isMobile || !selectedConversation}>
        <div className="flex h-full flex-col">
          {/* Simple Tab Buttons */}
          <div className="flex h-[52px] items-center border-b px-4">
            <button
              onClick={() => setSidebarTab("info")}
              className={`px-3 pb-3 pt-3 text-sm font-medium ${
                sidebarTab === "info"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Info
            </button>
            <button
              onClick={() => setSidebarTab("pages")}
              className={`px-3 pb-3 pt-3 text-sm font-medium ${
                sidebarTab === "pages"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Viewed pages
            </button>
            <button
              onClick={() => setSidebarTab("notes")}
              className={`px-3 pb-3 pt-3 text-sm font-medium ${
                sidebarTab === "notes"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Notes
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-auto p-4">
            {/* Info Tab */}
            {sidebarTab === "info" && selectedConversation && (
              <div>
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
                    </div>

                    {/* Phone */}
                    <div className="flex items-start gap-3">
                      <Phone className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
                      <span className="text-sm text-slate-500">
                        {selectedConversation.visitor_phone || "Not provided"}
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
                    </div>

                    {/* IP Address */}
                    <div className="flex items-start gap-3">
                      <Wifi className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
                      <span className="text-sm text-slate-900">
                        {getVisitorInfo(selectedConversation).ip || "Unknown"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Pre-chat Form Data */}
                {getPrechatData(selectedConversation) && Object.keys(getPrechatData(selectedConversation)!).length > 0 && (
                  <>
                    <Separator className="my-4" />
                    <div className="mb-6">
                      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Pre-chat Form
                      </h3>
                      <div className="rounded-lg border bg-blue-50 p-3 space-y-2">
                        {Object.entries(getPrechatData(selectedConversation)!).map(([key, value]) => (
                          <div key={key} className="flex justify-between text-sm">
                            <span className="text-slate-500 capitalize">{key}:</span>
                            <span className="font-medium text-slate-900">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Chat Rating Section */}
                {selectedConversation.rating && (
                  <>
                    <Separator className="my-4" />
                    <div className="mb-6">
                      <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                        <Star className="h-3 w-3" />
                        Chat Rating
                      </h3>
                      <div className="rounded-lg border bg-amber-50 p-3">
                        <div className="flex items-center gap-1 mb-2">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`h-5 w-5 ${
                                star <= selectedConversation.rating!
                                  ? "fill-amber-400 text-amber-400"
                                  : "text-slate-300"
                              }`}
                            />
                          ))}
                          <span className="ml-2 text-sm font-medium text-slate-700">
                            {selectedConversation.rating}/5
                          </span>
                        </div>
                        {selectedConversation.rating_feedback && (
                          <p className="text-sm text-slate-600 italic border-l-2 border-amber-300 pl-2 mt-2">
                            &quot;{selectedConversation.rating_feedback}&quot;
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                )}

                <Separator className="my-4" />

                {/* Tags Section */}
                <div className="mb-6">
                  <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    <Tag className="h-3 w-3" />
                    Tags
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
                      <a
                        href={getVisitorInfo(selectedConversation).currentPage}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                      >
                        <span className="truncate">{formatPageUrl(getVisitorInfo(selectedConversation).currentPage || "")}</span>
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                      </a>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No page data available</p>
                  )}
                </div>

                <button
                  onClick={() => setSidebarTab("pages")}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                >
                  <Clock className="h-4 w-4" />
                  See page history
                </button>
              </div>
            )}

            {/* Viewed Pages Tab */}
            {sidebarTab === "pages" && selectedConversation && (
              <div>
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
              </div>
            )}

            {/* Notes Tab */}
            {sidebarTab === "notes" && (
              <div>
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
              </div>
            )}
          </div>
        </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </TooltipProvider>
  );
}
