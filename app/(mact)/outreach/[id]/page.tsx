"use client";

import { useState, useEffect, use, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Send,
  Mail,
  MailOpen,
  MousePointerClick,
  MessageSquare,
  AlertTriangle,
  Loader2,
  Play,
  Pause,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  RefreshCcw,
  Terminal,
  Trash2,
  FlaskConical,
} from "lucide-react";
import { toast } from "sonner";
import type { OutreachCampaign, OutreachEvent, OutreachReply } from "@/types/outreach";

interface CampaignStats {
  total_recipients: number;
  sent: number;
  delivered: number;
  delivery_rate: string;
  opened: number;
  open_rate: string;
  clicked: number;
  click_rate: string;
  replied: number;
  reply_rate: string;
  bounced: number;
  bounce_rate: string;
}

interface ActivityEvent extends OutreachEvent {
  email?: {
    recipient_email: string;
    recipient_name: string;
  };
}

interface SendLog {
  id: string;
  campaign_id: string;
  email_id: string | null;
  level: "info" | "success" | "warning" | "error";
  step: string;
  message: string;
  data: Record<string, unknown> | null;
  created_at: string;
}

const statusConfig: Record<
  string,
  { label: string; color: string; icon: React.ReactNode }
> = {
  draft: {
    label: "Draft",
    color: "bg-slate-100 text-slate-700",
    icon: <FileText className="h-4 w-4" />,
  },
  scheduled: {
    label: "Scheduled",
    color: "bg-blue-100 text-blue-700",
    icon: <Clock className="h-4 w-4" />,
  },
  sending: {
    label: "Sending",
    color: "bg-amber-100 text-amber-700",
    icon: <Play className="h-4 w-4" />,
  },
  paused: {
    label: "Paused",
    color: "bg-orange-100 text-orange-700",
    icon: <Pause className="h-4 w-4" />,
  },
  completed: {
    label: "Completed",
    color: "bg-green-100 text-green-700",
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  cancelled: {
    label: "Cancelled",
    color: "bg-red-100 text-red-700",
    icon: <XCircle className="h-4 w-4" />,
  },
};

const eventIcons: Record<string, React.ReactNode> = {
  sent: <Send className="h-4 w-4 text-blue-500" />,
  delivered: <Mail className="h-4 w-4 text-green-500" />,
  opened: <MailOpen className="h-4 w-4 text-green-600" />,
  clicked: <MousePointerClick className="h-4 w-4 text-purple-500" />,
  replied: <MessageSquare className="h-4 w-4 text-blue-600" />,
  bounced: <AlertTriangle className="h-4 w-4 text-red-500" />,
};

export default function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [campaign, setCampaign] = useState<OutreachCampaign | null>(null);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [replies, setReplies] = useState<OutreachReply[]>([]);
  const [sendLogs, setSendLogs] = useState<SendLog[]>([]);
  const [showLogs, setShowLogs] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [selectedReply, setSelectedReply] = useState<OutreachReply | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchData();
  }, [id]);

  // Auto-scroll logs to bottom when new logs arrive
  useEffect(() => {
    if (logsEndRef.current && showLogs) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [sendLogs, showLogs]);

  // Track last log timestamp for incremental fetching
  const lastLogRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (sendLogs.length > 0) {
      lastLogRef.current = sendLogs[sendLogs.length - 1].created_at;
    }
  }, [sendLogs]);

  // Poll stats, logs and trigger processing while sending
  useEffect(() => {
    if (campaign?.status === "sending") {
      // Poll for new logs more frequently
      const logInterval = setInterval(async () => {
        await fetchSendLogs(lastLogRef.current);
      }, 1500);

      // Trigger processing and refresh stats less frequently
      const processInterval = setInterval(async () => {
        try {
          await fetch(`/api/outreach/campaigns/${id}/process`, {
            method: "POST",
          });
        } catch (err) {
          console.error("Process error:", err);
        }
        await fetchStats();
      }, 5000);

      return () => {
        clearInterval(logInterval);
        clearInterval(processInterval);
      };
    }
  }, [campaign?.status, id]); // Removed sendLogs to prevent interval reset

  const fetchData = async () => {
    await Promise.all([fetchStats(), fetchActivity(), fetchReplies(), fetchSendLogs()]);
    setLoading(false);
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`/api/outreach/campaigns/${id}/stats`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setCampaign(data.campaign);
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  };

  const fetchActivity = async () => {
    try {
      const res = await fetch(`/api/outreach/campaigns/${id}/activity?limit=10`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setActivity(data.events || []);
      }
    } catch (error) {
      console.error("Failed to fetch activity:", error);
    }
  };

  const fetchReplies = async () => {
    try {
      const res = await fetch(`/api/outreach/campaigns/${id}/replies?limit=10`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setReplies(data.replies || []);
      }
    } catch (error) {
      console.error("Failed to fetch replies:", error);
    }
  };

  const fetchSendLogs = async (since?: string) => {
    try {
      const url = since
        ? `/api/outreach/campaigns/${id}/logs?limit=100&since=${encodeURIComponent(since)}`
        : `/api/outreach/campaigns/${id}/logs?limit=100`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok && data.logs) {
        if (since) {
          // Append new logs
          setSendLogs((prev) => [...prev, ...data.logs]);
        } else {
          setSendLogs(data.logs);
        }
      }
    } catch (error) {
      console.error("Failed to fetch send logs:", error);
    }
  };

  const clearSendLogs = async () => {
    try {
      await fetch(`/api/outreach/campaigns/${id}/logs`, { method: "DELETE" });
      setSendLogs([]);
      toast.success("Logs cleared");
    } catch (error) {
      console.error("Failed to clear logs:", error);
    }
  };

  const handleStart = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/outreach/campaigns/${id}/send`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to start campaign");
      }
      toast.success("Campaign started");
      await fetchStats();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to start");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/outreach/campaigns/${id}/pause`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to pause campaign");
      }
      toast.success("Campaign paused");
      await fetchStats();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to pause");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/outreach/campaigns/${id}/resume`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to resume campaign");
      }
      toast.success("Campaign resumed");
      await fetchStats();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to resume");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/outreach/campaigns/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to cancel campaign");
      }
      toast.success("Campaign cancelled");
      await fetchStats();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to cancel");
    } finally {
      setActionLoading(false);
      setShowCancelDialog(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
    return formatDate(dateString);
  };

  const getProgress = () => {
    if (!stats || stats.total_recipients === 0) return 0;
    return Math.round((stats.sent / stats.total_recipients) * 100);
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-6xl">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-6xl">
        <div className="text-center py-12">
          <p className="text-slate-500">Campaign not found</p>
          <Link href="/outreach">
            <Button className="mt-4">Back to Campaigns</Button>
          </Link>
        </div>
      </div>
    );
  }

  const status = statusConfig[campaign.status] || statusConfig.draft;

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/outreach">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{campaign.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <Badge className={`${status.color} gap-1`} variant="secondary">
                {status.icon}
                {status.label}
              </Badge>
              <span className="text-sm text-slate-500">
                Created {formatDate(campaign.created_at)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={fetchData}>
            <RefreshCcw className="h-4 w-4" />
          </Button>

          {campaign.status === "draft" && (
            <Button onClick={handleStart} disabled={actionLoading}>
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Start
            </Button>
          )}

          {campaign.status === "sending" && (
            <Button
              variant="outline"
              onClick={handlePause}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Pause className="h-4 w-4 mr-2" />
              )}
              Pause
            </Button>
          )}

          {campaign.status === "paused" && (
            <>
              <Button onClick={handleResume} disabled={actionLoading}>
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Resume
              </Button>
              <Button
                variant="destructive"
                onClick={() => setShowCancelDialog(true)}
                disabled={actionLoading}
              >
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Dry Run Banner */}
      {campaign.is_dry_run && (
        <div className="mb-6 p-4 bg-purple-50 border-2 border-purple-300 rounded-lg flex items-center gap-3">
          <FlaskConical className="h-6 w-6 text-purple-600 shrink-0" />
          <div>
            <p className="font-semibold text-purple-900">Simulation Mode (Dry Run)</p>
            <p className="text-sm text-purple-700">
              This campaign ran in simulation mode. No actual emails were sent to recipients.
              All statistics show simulated results only.
            </p>
          </div>
        </div>
      )}

      {/* Progress */}
      {stats && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Sending Progress</span>
                  <span className="text-sm text-slate-500">
                    {stats.sent} / {stats.total_recipients} ({getProgress()}%)
                  </span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${getProgress()}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs for Overview vs Logs */}
      <Tabs defaultValue={campaign.status === "sending" ? "logs" : "overview"} className="mb-6">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            Send Logs
            {campaign.status === "sending" && (
              <span className="flex items-center gap-1 text-amber-600">
                <Loader2 className="h-3 w-3 animate-spin" />
              </span>
            )}
            {sendLogs.length > 0 && (
              <Badge variant="secondary" className="ml-1">{sendLogs.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Stats Grid */}
          {stats && (
            <div className="grid grid-cols-6 gap-4">
              <Card>
                <CardContent className="pt-6 text-center">
                  <Send className="h-6 w-6 mx-auto text-blue-500 mb-2" />
                  <p className="text-2xl font-bold">{stats.sent}</p>
                  <p className="text-xs text-slate-500">Sent</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <Mail className="h-6 w-6 mx-auto text-green-500 mb-2" />
                  <p className="text-2xl font-bold">{stats.delivered}</p>
                  <p className="text-xs text-slate-500">
                    Delivered ({stats.delivery_rate}%)
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <MailOpen className="h-6 w-6 mx-auto text-green-600 mb-2" />
                  <p className="text-2xl font-bold">{stats.opened}</p>
                  <p className="text-xs text-slate-500">
                    Opened ({stats.open_rate}%)
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <MousePointerClick className="h-6 w-6 mx-auto text-purple-500 mb-2" />
                  <p className="text-2xl font-bold">{stats.clicked}</p>
                  <p className="text-xs text-slate-500">
                    Clicked ({stats.click_rate}%)
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <MessageSquare className="h-6 w-6 mx-auto text-blue-600 mb-2" />
                  <p className="text-2xl font-bold">{stats.replied}</p>
                  <p className="text-xs text-slate-500">
                    Replied ({stats.reply_rate}%)
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <AlertTriangle className="h-6 w-6 mx-auto text-red-500 mb-2" />
                  <p className="text-2xl font-bold">{stats.bounced}</p>
                  <p className="text-xs text-slate-500">
                    Bounced ({stats.bounce_rate}%)
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="grid grid-cols-2 gap-6">
            {/* Activity Feed */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                {activity.length === 0 ? (
                  <p className="text-center text-slate-400 py-8">No activity yet</p>
                ) : (
                  <div className="space-y-3">
                    {activity.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center gap-3 py-2 border-b last:border-0"
                      >
                        {eventIcons[event.event_type] || <Mail className="h-4 w-4" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">
                            <span className="font-medium">
                              {event.email?.recipient_name ||
                                event.email?.recipient_email ||
                                "Unknown"}
                            </span>{" "}
                            <span className="text-slate-500">
                              {event.event_type}
                            </span>
                          </p>
                        </div>
                        <span className="text-xs text-slate-400">
                          {formatTimeAgo(event.created_at)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Replies */}
            <Card>
              <CardHeader>
                <CardTitle>Replies ({replies.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {replies.length === 0 ? (
                  <p className="text-center text-slate-400 py-8">No replies yet</p>
                ) : (
                  <div className="space-y-3">
                    {replies.map((reply) => (
                      <div
                        key={reply.id}
                        className="py-2 border-b last:border-0 cursor-pointer hover:bg-slate-50 rounded-md px-2 -mx-2 transition-colors"
                        onClick={() => setSelectedReply(reply)}
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">
                            {reply.from_name || reply.from_email}
                          </p>
                          <span className="text-xs text-slate-400">
                            {formatTimeAgo(reply.created_at)}
                          </span>
                        </div>
                        <p className="text-sm text-slate-500 truncate mt-1">
                          {reply.subject || "(No subject)"}
                        </p>
                        <p className="text-xs text-slate-400 truncate mt-1">
                          {reply.body_text?.substring(0, 100) || "(No content)"}...
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Campaign Details */}
          <Card>
            <CardHeader>
              <CardTitle>Campaign Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Template</p>
                  <p className="font-medium">
                    {(campaign as OutreachCampaign & { template?: { name: string } }).template?.name || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Segment</p>
                  <p className="font-medium capitalize">{campaign.segment}</p>
                </div>
                <div>
                  <p className="text-slate-500">Send Rate</p>
                  <p className="font-medium">{campaign.send_rate}/hour</p>
                </div>
                <div>
                  <p className="text-slate-500">From</p>
                  <p className="font-medium">
                    {campaign.from_name} &lt;{campaign.from_email}&gt;
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Started</p>
                  <p className="font-medium">{formatDate(campaign.started_at)}</p>
                </div>
                <div>
                  <p className="text-slate-500">
                    {campaign.status === "completed" ? "Completed" : "Updated"}
                  </p>
                  <p className="font-medium">
                    {formatDate(
                      campaign.status === "completed"
                        ? campaign.completed_at
                        : campaign.updated_at
                    )}
                  </p>
                </div>
                {campaign.is_dry_run && (
                  <div>
                    <p className="text-slate-500">Mode</p>
                    <p className="font-medium text-purple-600 flex items-center gap-1">
                      <FlaskConical className="h-4 w-4" />
                      Simulation (Dry Run)
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Send Logs Tab */}
        <TabsContent value="logs">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Terminal className="h-5 w-5" />
                  Real-time Send Logs
                  {campaign.status === "sending" && (
                    <span className="ml-2 flex items-center gap-1 text-sm font-normal text-amber-600">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Live
                    </span>
                  )}
                </CardTitle>
                {sendLogs.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSendLogs}
                    className="text-slate-500 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Clear Logs
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-slate-900 rounded-lg p-4 h-[500px] overflow-y-auto font-mono text-xs">
                {sendLogs.length === 0 ? (
                  <p className="text-slate-500">No logs yet. Start the campaign to see real-time activity.</p>
                ) : (
                  <div className="space-y-1">
                    {sendLogs.map((log) => (
                      <div
                        key={log.id}
                        className={`flex gap-2 ${
                          log.level === "error"
                            ? "text-red-400"
                            : log.level === "warning"
                            ? "text-yellow-400"
                            : log.level === "success"
                            ? "text-green-400"
                            : "text-slate-300"
                        }`}
                      >
                        <span className="text-slate-500 shrink-0">
                          {new Date(log.created_at).toLocaleTimeString()}
                        </span>
                        <span className="shrink-0 w-20">
                          [{log.level.toUpperCase()}]
                        </span>
                        <span className="text-slate-400 shrink-0 w-32 truncate">
                          {log.step}:
                        </span>
                        <span className="break-all">{log.message}</span>
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Reply Detail Dialog */}
      <Dialog open={!!selectedReply} onOpenChange={(open) => !open && setSelectedReply(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {selectedReply?.subject || "(No subject)"}
            </DialogTitle>
          </DialogHeader>
          {selectedReply && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm border-b pb-3">
                <div>
                  <span className="text-slate-500">From: </span>
                  <span className="font-medium">
                    {selectedReply.from_name && `${selectedReply.from_name} `}
                    &lt;{selectedReply.from_email}&gt;
                  </span>
                </div>
                <span className="text-xs text-slate-400">
                  {formatDate(selectedReply.created_at)}
                </span>
              </div>
              {selectedReply.status === "forwarded" && selectedReply.forwarded_to && (
                <div className="text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded">
                  Forwarded to {selectedReply.forwarded_to}
                </div>
              )}
              <div className="text-sm leading-relaxed whitespace-pre-wrap">
                {selectedReply.body_html ? (
                  <div
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: selectedReply.body_html }}
                  />
                ) : (
                  <p className="text-slate-700">
                    {selectedReply.body_text || "(No content)"}
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              This will stop the campaign and mark it as cancelled. Emails that
              have already been sent will not be affected. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>
              Keep Campaign
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={actionLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Cancel Campaign"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
