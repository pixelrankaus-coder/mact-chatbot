"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  ArrowLeft,
  Send,
  Mail,
  MailOpen,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface Analytics {
  overview: {
    total_campaigns: number;
    total_sent: number;
    total_delivered: number;
    total_opened: number;
    total_clicked: number;
    total_replied: number;
    total_bounced: number;
  };
  rates: {
    delivery_rate: string;
    open_rate: string;
    click_rate: string;
    reply_rate: string;
    bounce_rate: string;
  };
  campaigns: Array<{
    id: string;
    name: string;
    status: string;
    created_at: string;
    sent: number;
    delivered: number;
    open_rate: string;
    reply_rate: string;
    bounce_rate: string;
  }>;
  benchmarks: {
    delivery_rate: { target: number; rating: string };
    open_rate: { target: number; rating: string };
    click_rate: { target: number; rating: string };
    reply_rate: { target: number; rating: string };
    bounce_rate: { target: number; rating: string };
  };
}

const DATE_RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last year" },
];

const statusColors: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  scheduled: "bg-blue-100 text-blue-700",
  sending: "bg-amber-100 text-amber-700",
  paused: "bg-orange-100 text-orange-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [dateRange, setDateRange] = useState("30");

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const from = new Date();
      from.setDate(from.getDate() - parseInt(dateRange));

      const res = await fetch(
        `/api/outreach/analytics?from=${from.toISOString()}`
      );
      const data = await res.json();

      if (res.ok) {
        setAnalytics(data);
      }
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const getRatingIcon = (rating: string) => {
    switch (rating) {
      case "excellent":
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case "good":
        return <CheckCircle2 className="h-4 w-4 text-blue-600" />;
      case "fair":
        return <Minus className="h-4 w-4 text-amber-600" />;
      case "poor":
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-slate-400" />;
    }
  };

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case "excellent":
        return "text-green-600";
      case "good":
        return "text-blue-600";
      case "fair":
        return "text-amber-600";
      case "poor":
        return "text-red-600";
      default:
        return "text-slate-400";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
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
            <h1 className="text-2xl font-bold">Outreach Analytics</h1>
            <p className="text-sm text-slate-500">
              Aggregate performance across all campaigns
            </p>
          </div>
        </div>

        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATE_RANGES.map((range) => (
              <SelectItem key={range.value} value={range.value}>
                {range.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!analytics ? (
        <div className="text-center py-12 text-slate-400">
          No data available
        </div>
      ) : (
        <>
          {/* Overview Cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100">
                    <Send className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {analytics.overview.total_sent.toLocaleString()}
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
                      {analytics.overview.total_delivered.toLocaleString()}
                    </p>
                    <p className="text-sm text-slate-500">
                      Delivered ({analytics.rates.delivery_rate}%)
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-100">
                    <MailOpen className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {analytics.overview.total_opened.toLocaleString()}
                    </p>
                    <p className="text-sm text-slate-500">
                      Opened ({analytics.rates.open_rate}%)
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-100">
                    <MessageSquare className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {analytics.overview.total_replied.toLocaleString()}
                    </p>
                    <p className="text-sm text-slate-500">
                      Replied ({analytics.rates.reply_rate}%)
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* Campaign Comparison */}
            <Card>
              <CardHeader>
                <CardTitle>Campaign Performance</CardTitle>
              </CardHeader>
              <CardContent>
                {analytics.campaigns.length === 0 ? (
                  <p className="text-center text-slate-400 py-8">
                    No campaigns in this period
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Campaign</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Sent</TableHead>
                        <TableHead className="text-right">Open %</TableHead>
                        <TableHead className="text-right">Reply %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analytics.campaigns.slice(0, 10).map((campaign) => (
                        <TableRow key={campaign.id}>
                          <TableCell>
                            <Link
                              href={`/outreach/${campaign.id}`}
                              className="font-medium hover:text-blue-600"
                            >
                              {campaign.name}
                            </Link>
                            <p className="text-xs text-slate-400">
                              {formatDate(campaign.created_at)}
                            </p>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={
                                statusColors[campaign.status] ||
                                "bg-slate-100 text-slate-700"
                              }
                              variant="secondary"
                            >
                              {campaign.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {campaign.sent}
                          </TableCell>
                          <TableCell className="text-right">
                            {campaign.open_rate}%
                          </TableCell>
                          <TableCell className="text-right">
                            {campaign.reply_rate}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Benchmarks */}
            <Card>
              <CardHeader>
                <CardTitle>Performance vs Industry Benchmarks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Open Rate */}
                  <div className="flex items-center justify-between py-3 border-b">
                    <div className="flex items-center gap-3">
                      {getRatingIcon(analytics.benchmarks.open_rate.rating)}
                      <div>
                        <p className="font-medium">Open Rate</p>
                        <p className="text-xs text-slate-400">
                          Industry avg: {analytics.benchmarks.open_rate.target}%
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-xl font-bold ${getRatingColor(analytics.benchmarks.open_rate.rating)}`}
                      >
                        {analytics.rates.open_rate}%
                      </p>
                      <p className="text-xs text-slate-400 capitalize">
                        {analytics.benchmarks.open_rate.rating}
                      </p>
                    </div>
                  </div>

                  {/* Reply Rate */}
                  <div className="flex items-center justify-between py-3 border-b">
                    <div className="flex items-center gap-3">
                      {getRatingIcon(analytics.benchmarks.reply_rate.rating)}
                      <div>
                        <p className="font-medium">Reply Rate</p>
                        <p className="text-xs text-slate-400">
                          Industry avg: {analytics.benchmarks.reply_rate.target}
                          %
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-xl font-bold ${getRatingColor(analytics.benchmarks.reply_rate.rating)}`}
                      >
                        {analytics.rates.reply_rate}%
                      </p>
                      <p className="text-xs text-slate-400 capitalize">
                        {analytics.benchmarks.reply_rate.rating}
                      </p>
                    </div>
                  </div>

                  {/* Delivery Rate */}
                  <div className="flex items-center justify-between py-3 border-b">
                    <div className="flex items-center gap-3">
                      {getRatingIcon(analytics.benchmarks.delivery_rate.rating)}
                      <div>
                        <p className="font-medium">Delivery Rate</p>
                        <p className="text-xs text-slate-400">
                          Target: {analytics.benchmarks.delivery_rate.target}%
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-xl font-bold ${getRatingColor(analytics.benchmarks.delivery_rate.rating)}`}
                      >
                        {analytics.rates.delivery_rate}%
                      </p>
                      <p className="text-xs text-slate-400 capitalize">
                        {analytics.benchmarks.delivery_rate.rating}
                      </p>
                    </div>
                  </div>

                  {/* Bounce Rate */}
                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      {getRatingIcon(analytics.benchmarks.bounce_rate.rating)}
                      <div>
                        <p className="font-medium">Bounce Rate</p>
                        <p className="text-xs text-slate-400">
                          Target: &lt;{analytics.benchmarks.bounce_rate.target}%
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-xl font-bold ${getRatingColor(analytics.benchmarks.bounce_rate.rating)}`}
                      >
                        {analytics.rates.bounce_rate}%
                      </p>
                      <p className="text-xs text-slate-400 capitalize">
                        {analytics.benchmarks.bounce_rate.rating}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Summary Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-4 text-center">
                <div>
                  <p className="text-3xl font-bold text-blue-600">
                    {analytics.overview.total_campaigns}
                  </p>
                  <p className="text-sm text-slate-500">Campaigns</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-green-600">
                    {analytics.overview.total_sent.toLocaleString()}
                  </p>
                  <p className="text-sm text-slate-500">Emails Sent</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-purple-600">
                    {analytics.overview.total_opened.toLocaleString()}
                  </p>
                  <p className="text-sm text-slate-500">Opens</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-amber-600">
                    {analytics.overview.total_replied.toLocaleString()}
                  </p>
                  <p className="text-sm text-slate-500">Replies</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-red-600">
                    {analytics.overview.total_bounced.toLocaleString()}
                  </p>
                  <p className="text-sm text-slate-500">Bounces</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
