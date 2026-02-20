"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Settings,
  Search,
  MoreVertical,
  Archive,
  Copy,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import type { OutreachCampaign } from "@/types/outreach";

const statusConfig: Record<
  string,
  { label: string; variant: "secondary" | "info" | "warning" | "success" | "destructive"; icon: React.ReactNode }
> = {
  draft: {
    label: "Draft",
    variant: "secondary",
    icon: <FileText className="h-3 w-3" />,
  },
  scheduled: {
    label: "Scheduled",
    variant: "info",
    icon: <Clock className="h-3 w-3" />,
  },
  sending: {
    label: "Sending",
    variant: "warning",
    icon: <Play className="h-3 w-3" />,
  },
  paused: {
    label: "Paused",
    variant: "warning",
    icon: <Pause className="h-3 w-3" />,
  },
  completed: {
    label: "Completed",
    variant: "success",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  cancelled: {
    label: "Cancelled",
    variant: "destructive",
    icon: <XCircle className="h-3 w-3" />,
  },
};

export default function OutreachPage() {
  const [campaigns, setCampaigns] = useState<OutreachCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [segmentFilter, setSegmentFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

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
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(campaignId);
        return next;
      });
    } catch (error) {
      console.error("Failed to delete campaign:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  const handleSendNow = async (campaignId: string) => {
    setSendingId(campaignId);
    try {
      const res = await fetch(`/api/outreach/campaigns/${campaignId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: false }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to start campaign");
      }
      toast.success("Campaign sending started");
      // Update local state
      setCampaigns((prev) =>
        prev.map((c) => (c.id === campaignId ? { ...c, status: "sending" } : c))
      );
    } catch (error) {
      console.error("Failed to send campaign:", error);
      toast.error(error instanceof Error ? error.message : "Failed to send");
    } finally {
      setSendingId(null);
    }
  };

  const handleBulkDelete = async () => {
    const count = selectedIds.size;
    if (count === 0) return;

    // Check for any "sending" campaigns in selection
    const sendingCampaigns = campaigns.filter(
      (c) => selectedIds.has(c.id) && c.status === "sending"
    );
    if (sendingCampaigns.length > 0) {
      toast.error("Cannot delete campaigns that are currently sending");
      return;
    }

    if (!confirm(`Delete ${count} campaign${count > 1 ? "s" : ""}? This cannot be undone.`)) {
      return;
    }

    setBulkDeleting(true);
    let deleted = 0;
    let failed = 0;
    const deletedIds = new Set<string>();

    for (const id of selectedIds) {
      try {
        const res = await fetch(`/api/outreach/campaigns/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          failed++;
        } else {
          deleted++;
          deletedIds.add(id);
        }
      } catch {
        failed++;
      }
    }

    setCampaigns((prev) => prev.filter((c) => !deletedIds.has(c.id)));
    setSelectedIds(new Set());
    setBulkDeleting(false);

    if (failed > 0) {
      toast.error(`Deleted ${deleted}, failed to delete ${failed}`);
    } else {
      toast.success(`Deleted ${deleted} campaign${deleted > 1 ? "s" : ""}`);
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

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredCampaigns.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCampaigns.map((c) => c.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Get unique segments for filter
  const segments = Array.from(new Set(campaigns.map((c) => c.segment)));

  // Extract campaign type from name (suffix after last underscore)
  const getCampaignType = (name: string) => {
    const parts = name.split("_");
    return parts.length >= 3 ? parts[parts.length - 1] : null;
  };

  // Filter campaigns
  const filteredCampaigns = campaigns.filter((campaign) => {
    const matchesSearch =
      !searchQuery ||
      campaign.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || campaign.status === statusFilter;
    const matchesSegment =
      segmentFilter === "all" || campaign.segment === segmentFilter;
    const matchesType =
      typeFilter === "all" || getCampaignType(campaign.name) === typeFilter;
    return matchesSearch && matchesStatus && matchesSegment && matchesType;
  });

  // Calculate stats
  const totalSent = campaigns.reduce((acc, c) => acc + c.sent_count, 0);
  const totalOpened = campaigns.reduce((acc, c) => acc + c.opened_count, 0);
  const totalReplied = campaigns.reduce((acc, c) => acc + c.replied_count, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-row items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">Outreach</h1>
          <p className="text-muted-foreground text-sm">
            Personal email campaigns to win back customers
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/outreach/templates">
            <Button variant="outline" size="sm">
              <FileText className="h-4 w-4" />
              <span className="hidden lg:inline">Templates</span>
            </Button>
          </Link>
          <Link href="/outreach/analytics">
            <Button variant="outline" size="sm">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden lg:inline">Analytics</span>
            </Button>
          </Link>
          <Link href="/outreach/settings">
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4" />
              <span className="hidden lg:inline">Settings</span>
            </Button>
          </Link>
          <Link href="/outreach/new">
            <Button size="sm">
              <Plus className="h-4 w-4" />
              <span className="hidden lg:inline">New Campaign</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Total Sent</CardDescription>
            <div className="flex flex-col gap-2">
              <h4 className="font-display text-2xl lg:text-3xl">{totalSent}</h4>
            </div>
            <CardAction>
              <div className="bg-muted flex size-12 items-center justify-center rounded-full border">
                <Send className="size-5" />
              </div>
            </CardAction>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Opened</CardDescription>
            <div className="flex flex-col gap-2">
              <h4 className="font-display text-2xl lg:text-3xl">{totalOpened}</h4>
              <div className="text-muted-foreground text-sm">
                {totalSent > 0 && (
                  <span className="text-emerald-600">{((totalOpened / totalSent) * 100).toFixed(1)}%</span>
                )}
              </div>
            </div>
            <CardAction>
              <div className="bg-muted flex size-12 items-center justify-center rounded-full border">
                <Mail className="size-5" />
              </div>
            </CardAction>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Replied</CardDescription>
            <div className="flex flex-col gap-2">
              <h4 className="font-display text-2xl lg:text-3xl">{totalReplied}</h4>
              <div className="text-muted-foreground text-sm">
                {totalSent > 0 && (
                  <span className="text-emerald-600">{((totalReplied / totalSent) * 100).toFixed(1)}%</span>
                )}
              </div>
            </div>
            <CardAction>
              <div className="bg-muted flex size-12 items-center justify-center rounded-full border">
                <Mail className="size-5" />
              </div>
            </CardAction>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Campaigns</CardDescription>
            <div className="flex flex-col gap-2">
              <h4 className="font-display text-2xl lg:text-3xl">{campaigns.length}</h4>
            </div>
            <CardAction>
              <div className="bg-muted flex size-12 items-center justify-center rounded-full border">
                <Archive className="size-5" />
              </div>
            </CardAction>
          </CardHeader>
        </Card>
      </div>

      {/* Filters Row */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search campaigns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 w-64"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sending">Sending</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={segmentFilter} onValueChange={setSegmentFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Segments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Segments</SelectItem>
            {segments.map((segment) => (
              <SelectItem key={segment} value={segment}>
                {segment.charAt(0).toUpperCase() + segment.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="product">Product Launch</SelectItem>
            <SelectItem value="training">Training / Course</SelectItem>
            <SelectItem value="technical">Technical / Specs</SelectItem>
            <SelectItem value="promo">Promo / Discount</SelectItem>
            <SelectItem value="newsletter">Newsletter</SelectItem>
            <SelectItem value="winback">Win-back</SelectItem>
            <SelectItem value="behavioral">Behavioral</SelectItem>
          </SelectContent>
        </Select>
        {selectedIds.size > 0 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
          >
            {bulkDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Delete {selectedIds.size} selected
          </Button>
        )}
      </div>

      {/* Campaigns Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-16">
              <Mail className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-1">
                No campaigns yet
              </h3>
              <p className="text-muted-foreground mb-4">
                Create your first outreach campaign to start winning back customers
              </p>
              <Link href="/outreach/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Campaign
                </Button>
              </Link>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 px-6">
                      <Checkbox
                        checked={
                          filteredCampaigns.length > 0 &&
                          selectedIds.size === filteredCampaigns.length
                        }
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
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
                  {filteredCampaigns.map((campaign) => {
                    const status = statusConfig[campaign.status];
                    const progress = getProgress(campaign);

                    return (
                      <TableRow key={campaign.id}>
                        <TableCell className="px-6">
                          <Checkbox
                            checked={selectedIds.has(campaign.id)}
                            onCheckedChange={() => toggleSelect(campaign.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <Link
                              href={`/outreach/${campaign.id}`}
                              className="font-medium hover:text-primary"
                            >
                              {campaign.name}
                            </Link>
                            <p className="text-muted-foreground text-sm">
                              {campaign.segment} segment
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant={status.variant} className="gap-1">
                              {status.icon}
                              {status.label}
                            </Badge>
                            {campaign.is_dry_run && (
                              <Badge variant="outline" className="text-xs">
                                Dry Run
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  campaign.status === "draft"
                                    ? "bg-muted-foreground/30"
                                    : campaign.status === "completed"
                                    ? "bg-emerald-500"
                                    : campaign.status === "cancelled"
                                    ? "bg-destructive"
                                    : "bg-primary"
                                }`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-muted-foreground text-sm">
                              {campaign.sent_count}/{campaign.total_recipients}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {getOpenRate(campaign)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {getReplyRate(campaign)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(campaign.created_at)}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/outreach/${campaign.id}`}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
                                </Link>
                              </DropdownMenuItem>
                              {(campaign.status === "draft" || campaign.status === "scheduled") && (
                                <DropdownMenuItem
                                  disabled={sendingId === campaign.id}
                                  onClick={() => handleSendNow(campaign.id)}
                                >
                                  {sendingId === campaign.id ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  ) : (
                                    <Play className="h-4 w-4 mr-2" />
                                  )}
                                  Send Now
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem>
                                <Copy className="h-4 w-4 mr-2" />
                                Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                disabled={
                                  deletingId === campaign.id ||
                                  campaign.status === "sending"
                                }
                                onClick={() =>
                                  handleDelete(campaign.id, campaign.name)
                                }
                              >
                                {deletingId === campaign.id ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4 mr-2" />
                                )}
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
