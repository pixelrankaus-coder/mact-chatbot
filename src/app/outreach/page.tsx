"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Mail,
  Send,
  BarChart3,
  FileText,
  Loader2,
  Play,
  Pause,
  CheckCircle2,
  Clock,
  XCircle,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { OutreachCampaign } from "@/types/outreach";

const statusConfig: Record<
  string,
  { label: string; color: string; icon: React.ReactNode }
> = {
  draft: {
    label: "Draft",
    color: "bg-slate-100 text-slate-700",
    icon: <FileText className="h-3 w-3" />,
  },
  scheduled: {
    label: "Scheduled",
    color: "bg-blue-100 text-blue-700",
    icon: <Clock className="h-3 w-3" />,
  },
  sending: {
    label: "Sending",
    color: "bg-amber-100 text-amber-700",
    icon: <Play className="h-3 w-3" />,
  },
  paused: {
    label: "Paused",
    color: "bg-orange-100 text-orange-700",
    icon: <Pause className="h-3 w-3" />,
  },
  completed: {
    label: "Completed",
    color: "bg-green-100 text-green-700",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  cancelled: {
    label: "Cancelled",
    color: "bg-red-100 text-red-700",
    icon: <XCircle className="h-3 w-3" />,
  },
};

export default function OutreachPage() {
  const [campaigns, setCampaigns] = useState<OutreachCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleDelete = async (campaignId: string, campaignName: string) => {
    if (!confirm(`Delete campaign "${campaignName}"? This cannot be undone.`)) {
      return;
    }

    setDeletingId(campaignId);
    try {
      const res = await fetch(`/api/outreach/campaigns/${campaignId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete campaign");
      }
      toast.success("Campaign deleted");
      setCampaigns((prev) => prev.filter((c) => c.id !== campaignId));
    } catch (error) {
      console.error("Failed to delete campaign:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  const fetchCampaigns = async () => {
    try {
      const res = await fetch("/api/outreach/campaigns");
      const data = await res.json();
      setCampaigns(data.campaigns || []);
    } catch (error) {
      console.error("Failed to fetch campaigns:", error);
      toast.error("Failed to load campaigns");
    } finally {
      setLoading(false);
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

  const getProgress = (campaign: OutreachCampaign) => {
    if (campaign.total_recipients === 0) return 0;
    return Math.round(
      (campaign.sent_count / campaign.total_recipients) * 100
    );
  };

  const getOpenRate = (campaign: OutreachCampaign) => {
    if (campaign.delivered_count === 0) return "-";
    return `${((campaign.opened_count / campaign.delivered_count) * 100).toFixed(1)}%`;
  };

  const getReplyRate = (campaign: OutreachCampaign) => {
    if (campaign.delivered_count === 0) return "-";
    return `${((campaign.replied_count / campaign.delivered_count) * 100).toFixed(1)}%`;
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Outreach</h1>
          <p className="text-sm text-slate-500">
            Personal email campaigns to win back customers
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/outreach/templates">
            <Button variant="outline" className="gap-2">
              <FileText className="h-4 w-4" />
              Templates
            </Button>
          </Link>
          <Link href="/outreach/analytics">
            <Button variant="outline" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </Button>
          </Link>
          <Link href="/outreach/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Campaign
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Send className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {campaigns.reduce((acc, c) => acc + c.sent_count, 0)}
                </p>
                <p className="text-sm text-slate-500">Total Sent</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <Mail className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {campaigns.reduce((acc, c) => acc + c.opened_count, 0)}
                </p>
                <p className="text-sm text-slate-500">Opened</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <Mail className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {campaigns.reduce((acc, c) => acc + c.replied_count, 0)}
                </p>
                <p className="text-sm text-slate-500">Replied</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100">
                <BarChart3 className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{campaigns.length}</p>
                <p className="text-sm text-slate-500">Campaigns</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Campaigns List */}
      <Card>
        <CardHeader>
          <CardTitle>Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-12">
              <Mail className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-1">
                No campaigns yet
              </h3>
              <p className="text-slate-500 mb-4">
                Create your first outreach campaign to start winning back
                customers
              </p>
              <Link href="/outreach/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Campaign
                </Button>
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Open Rate</TableHead>
                  <TableHead>Reply Rate</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => {
                  const status = statusConfig[campaign.status];
                  const progress = getProgress(campaign);

                  return (
                    <TableRow key={campaign.id}>
                      <TableCell>
                        <Link
                          href={`/outreach/${campaign.id}`}
                          className="font-medium hover:text-blue-600"
                        >
                          {campaign.name}
                        </Link>
                        <p className="text-sm text-slate-500">
                          {campaign.segment} segment
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`${status.color} gap-1`}
                          variant="secondary"
                        >
                          {status.icon}
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-sm text-slate-500">
                            {campaign.sent_count}/{campaign.total_recipients}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{getOpenRate(campaign)}</TableCell>
                      <TableCell>{getReplyRate(campaign)}</TableCell>
                      <TableCell className="text-slate-500">
                        {formatDate(campaign.created_at)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-red-500"
                          onClick={(e) => {
                            e.preventDefault();
                            handleDelete(campaign.id, campaign.name);
                          }}
                          disabled={deletingId === campaign.id || campaign.status === "sending"}
                          title={campaign.status === "sending" ? "Cannot delete while sending" : "Delete campaign"}
                        >
                          {deletingId === campaign.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
