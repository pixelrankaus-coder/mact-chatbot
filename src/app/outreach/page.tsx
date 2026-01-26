"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
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
    color: "bg-yellow-100 text-yellow-800",
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [segmentFilter, setSegmentFilter] = useState("all");

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

  // Filter campaigns
  const filteredCampaigns = campaigns.filter((campaign) => {
    const matchesSearch =
      !searchQuery ||
      campaign.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || campaign.status === statusFilter;
    const matchesSegment =
      segmentFilter === "all" || campaign.segment === segmentFilter;
    return matchesSearch && matchesStatus && matchesSegment;
  });

  // Calculate stats
  const totalSent = campaigns.reduce((acc, c) => acc + c.sent_count, 0);
  const totalOpened = campaigns.reduce((acc, c) => acc + c.opened_count, 0);
  const totalReplied = campaigns.reduce((acc, c) => acc + c.replied_count, 0);

  return (
    <div className="flex-1 overflow-auto">
      {/* Header */}
      <div className="bg-white border-b px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Outreach</h1>
            <p className="text-sm text-slate-500 mt-1">
              Personal email campaigns to win back customers
            </p>
          </div>
          <div className="flex items-center gap-3">
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
            <Link href="/outreach/settings">
              <Button variant="outline" className="gap-2">
                <Settings className="h-4 w-4" />
                Settings
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
      </div>

      {/* Stats Cards */}
      <div className="px-8 py-6">
        <div className="grid grid-cols-4 gap-6">
          <Card className="rounded-xl">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Send className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{totalSent}</p>
                  <p className="text-sm text-slate-500">Total Sent</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-xl">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Mail className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{totalOpened}</p>
                  <p className="text-sm text-slate-500">Opened</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-xl">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Mail className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{totalReplied}</p>
                  <p className="text-sm text-slate-500">Replied</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-xl">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                  <Archive className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{campaigns.length}</p>
                  <p className="text-sm text-slate-500">Campaigns</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Filters Row */}
      <div className="px-8 pb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
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
        </div>
      </div>

      {/* Campaigns Table */}
      <div className="px-8 pb-8">
        <Card className="rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-16">
              <Mail className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-1">
                No campaigns yet
              </h3>
              <p className="text-slate-500 mb-4">
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
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead className="w-12 px-6">
                    <Checkbox
                      checked={
                        filteredCampaigns.length > 0 &&
                        selectedIds.size === filteredCampaigns.length
                      }
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="font-semibold text-slate-500 uppercase text-xs tracking-wider">
                    Campaign
                  </TableHead>
                  <TableHead className="font-semibold text-slate-500 uppercase text-xs tracking-wider">
                    Status
                  </TableHead>
                  <TableHead className="font-semibold text-slate-500 uppercase text-xs tracking-wider">
                    Progress
                  </TableHead>
                  <TableHead className="font-semibold text-slate-500 uppercase text-xs tracking-wider">
                    Open Rate
                  </TableHead>
                  <TableHead className="font-semibold text-slate-500 uppercase text-xs tracking-wider">
                    Reply Rate
                  </TableHead>
                  <TableHead className="font-semibold text-slate-500 uppercase text-xs tracking-wider">
                    Created
                  </TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCampaigns.map((campaign) => {
                  const status = statusConfig[campaign.status];
                  const progress = getProgress(campaign);

                  return (
                    <TableRow key={campaign.id} className="hover:bg-slate-50">
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
                            className="font-medium text-slate-900 hover:text-blue-600"
                          >
                            {campaign.name}
                          </Link>
                          <p className="text-sm text-slate-500">
                            {campaign.segment} segment
                          </p>
                        </div>
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
                        <div className="flex items-center gap-3">
                          <Progress
                            value={progress}
                            className="w-32 h-2 bg-slate-200"
                          />
                          <span className="text-sm text-slate-600">
                            {campaign.sent_count}/{campaign.total_recipients}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {getOpenRate(campaign)}
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {getReplyRate(campaign)}
                      </TableCell>
                      <TableCell className="text-slate-500">
                        {formatDate(campaign.created_at)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-400 hover:text-slate-600"
                            >
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
                            <DropdownMenuItem>
                              <Copy className="h-4 w-4 mr-2" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600 focus:text-red-600"
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
          )}
        </Card>
      </div>
    </div>
  );
}
