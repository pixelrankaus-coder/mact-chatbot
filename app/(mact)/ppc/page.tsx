"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  TrendingUp,
  TrendingDown,
  DollarSign,
  MousePointerClick,
  Target,
  Percent,
  RefreshCw,
  Settings,
  Loader2,
  BarChart3,
  MapPin,
  Search,
  AlertCircle,
  Lightbulb,
  X,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Types
interface SummaryMetrics {
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  conversion_value: number;
  ctr: number;
  cpc: number | null;
  cpa: number | null;
  roas: number | null;
  period: number;
}

interface CampaignMetrics {
  campaign_id: string;
  campaign_name: string;
  campaign_status: string;
  campaign_type: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  ctr: number;
  cpc: number | null;
  cpa: number | null;
  roas: number | null;
}

interface KeywordMetrics {
  keyword_id: string;
  keyword_text: string;
  match_type: string;
  campaign_name: string;
  ad_group_name: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  quality_score: number | null;
  ctr: number;
  cpa: number | null;
}

interface GeoMetrics {
  location_id: string;
  location_name: string;
  location_type: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  ctr: number;
  cpa: number | null;
}

interface Recommendation {
  id: string;
  recommendation_type: string;
  priority: string;
  title: string;
  insight: string;
  recommendation: string;
  expected_impact: string;
  confidence: string;
}

interface Connection {
  id: string;
  customer_id: string;
  account_name: string;
  last_sync_at: string | null;
  sync_status: string;
  sync_error: string | null;
}

// Format helpers
const formatCurrency = (value: number | null, decimals = 2) => {
  if (value === null || value === undefined) return "-";
  return `$${value.toLocaleString("en-AU", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
};

const formatNumber = (value: number | null) => {
  if (value === null || value === undefined) return "-";
  return value.toLocaleString("en-AU");
};

const formatPercent = (value: number | null, decimals = 2) => {
  if (value === null || value === undefined) return "-";
  return `${value.toFixed(decimals)}%`;
};

const formatRoas = (value: number | null) => {
  if (value === null || value === undefined) return "-";
  return `${value.toFixed(2)}x`;
};

// Status badge component
const StatusBadge = ({ status }: { status: string }) => {
  const config: Record<string, { label: string; variant: "default" | "secondary" | "success" | "destructive" }> = {
    ENABLED: { label: "Active", variant: "success" },
    PAUSED: { label: "Paused", variant: "secondary" },
    REMOVED: { label: "Removed", variant: "destructive" },
  };
  const { label, variant } = config[status] || { label: status, variant: "default" };
  return <Badge variant={variant}>{label}</Badge>;
};

// Match type badge
const MatchTypeBadge = ({ type }: { type: string }) => {
  const colors: Record<string, string> = {
    EXACT: "bg-blue-100 text-blue-700",
    PHRASE: "bg-purple-100 text-purple-700",
    BROAD: "bg-gray-100 text-gray-700",
  };
  return (
    <span className={cn("rounded px-2 py-0.5 text-xs font-medium", colors[type] || "bg-gray-100 text-gray-700")}>
      {type.toLowerCase()}
    </span>
  );
};

// Quality score badge
const QualityScoreBadge = ({ score }: { score: number | null }) => {
  if (score === null) return <span className="text-muted-foreground">-</span>;
  const color =
    score >= 7 ? "text-green-600" : score >= 5 ? "text-yellow-600" : "text-red-600";
  return <span className={cn("font-semibold", color)}>{score}/10</span>;
};

// Trend indicator
const TrendIndicator = ({ value, inverse = false }: { value: number; inverse?: boolean }) => {
  const isPositive = inverse ? value < 0 : value > 0;
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus;
  return (
    <span className={cn("flex items-center gap-1 text-xs font-medium", isPositive ? "text-green-600" : value === 0 ? "text-muted-foreground" : "text-red-600")}>
      <Icon className="h-3 w-3" />
      {Math.abs(value).toFixed(1)}%
    </span>
  );
};

export default function PPCPage() {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [summary, setSummary] = useState<SummaryMetrics | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignMetrics[]>([]);
  const [keywords, setKeywords] = useState<KeywordMetrics[]>([]);
  const [geoData, setGeoData] = useState<GeoMetrics[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [period, setPeriod] = useState("30");

  // Fetch data
  useEffect(() => {
    fetchData();
  }, [period]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch connection status
      const connRes = await fetch("/api/ppc/connection");
      const connData = await connRes.json();
      setConnection(connData.connection);

      if (!connData.connection) {
        setLoading(false);
        return;
      }

      // Fetch all metrics in parallel
      const [summaryRes, campaignsRes, keywordsRes, geoRes, recsRes] = await Promise.all([
        fetch(`/api/ppc/metrics?type=summary&period=${period}`),
        fetch(`/api/ppc/metrics?type=campaigns&period=${period}`),
        fetch(`/api/ppc/metrics?type=keywords&period=${period}`),
        fetch(`/api/ppc/metrics?type=geo&period=${period}`),
        fetch("/api/ppc/recommendations"),
      ]);

      const [summaryData, campaignsData, keywordsData, geoDataRes, recsData] = await Promise.all([
        summaryRes.json(),
        campaignsRes.json(),
        keywordsRes.json(),
        geoRes.json(),
        recsRes.json(),
      ]);

      setSummary(summaryData.data);
      setCampaigns(campaignsData.data || []);
      setKeywords(keywordsData.data || []);
      setGeoData(geoDataRes.data || []);
      setRecommendations(recsData.recommendations || []);
    } catch (error) {
      console.error("Error fetching PPC data:", error);
      toast.error("Failed to load PPC data");
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/ppc/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success("Sync completed successfully");
        fetchData();
      } else {
        toast.error(data.error || "Sync failed");
      }
    } catch (error) {
      toast.error("Failed to sync data");
    } finally {
      setSyncing(false);
    }
  };

  const dismissRecommendation = async (id: string) => {
    try {
      await fetch("/api/ppc/recommendations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "dismiss" }),
      });
      setRecommendations((prev) => prev.filter((r) => r.id !== id));
    } catch (error) {
      toast.error("Failed to dismiss recommendation");
    }
  };

  // No connection state
  if (!loading && !connection) {
    return (
      <div className="flex h-[calc(100vh-12rem)] items-center justify-center">
        <div className="text-center max-w-md">
          <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <TrendingUp className="size-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Connect Google Ads</h2>
          <p className="text-muted-foreground mb-6">
            Connect your Google Ads account to view campaign performance,
            track keywords, and get AI-powered optimization recommendations.
          </p>
          <Link href="/settings/integrations">
            <Button>
              <Settings className="size-4 mr-2" />
              Configure Integration
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">PPC Performance</h1>
          <p className="text-muted-foreground text-sm">
            {connection?.account_name || "Google Ads"} campaign metrics and insights
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="60">Last 60 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleSync} disabled={syncing}>
            {syncing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            <span className="hidden sm:inline ml-2">Sync</span>
          </Button>
          <Link href="/settings/integrations">
            <Button variant="outline" size="icon">
              <Settings className="size-4" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Sync Status */}
      {connection?.last_sync_at && (
        <div className="text-xs text-muted-foreground">
          Last synced: {new Date(connection.last_sync_at).toLocaleString("en-AU")}
          {connection.sync_status === "error" && (
            <span className="text-red-500 ml-2">
              <AlertCircle className="inline h-3 w-3 mr-1" />
              {connection.sync_error}
            </span>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4" />
              <span className="text-sm">Spend</span>
            </div>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{formatCurrency(summary?.spend || 0)}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <MousePointerClick className="h-4 w-4" />
              <span className="text-sm">Clicks</span>
            </div>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{formatNumber(summary?.clicks || 0)}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Target className="h-4 w-4" />
              <span className="text-sm">Conversions</span>
            </div>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{summary?.conversions?.toFixed(1) || "0"}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4" />
              <span className="text-sm">CPA</span>
            </div>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{formatCurrency(summary?.cpa)}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Percent className="h-4 w-4" />
              <span className="text-sm">CTR</span>
            </div>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{formatPercent(summary?.ctr)}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">ROAS</span>
            </div>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{formatRoas(summary?.roas)}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI Recommendations */}
      {recommendations.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-500" />
              <CardTitle className="text-base">AI Recommendations</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {recommendations.slice(0, 3).map((rec) => (
              <div
                key={rec.id}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3",
                  rec.priority === "high" && "border-red-200 bg-red-50",
                  rec.priority === "medium" && "border-yellow-200 bg-yellow-50",
                  rec.priority === "low" && "border-blue-200 bg-blue-50"
                )}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{rec.title}</span>
                    <Badge variant="outline" className="text-xs">
                      {rec.recommendation_type.replace("_", " ")}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{rec.insight}</p>
                  {rec.recommendation && (
                    <p className="text-sm mt-1">
                      <span className="font-medium">Action:</span> {rec.recommendation}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => dismissRecommendation(rec.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Tabs for detailed data */}
      <Tabs defaultValue="campaigns" className="space-y-4">
        <TabsList>
          <TabsTrigger value="campaigns" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Campaigns
          </TabsTrigger>
          <TabsTrigger value="keywords" className="gap-2">
            <Search className="h-4 w-4" />
            Keywords
          </TabsTrigger>
          <TabsTrigger value="geo" className="gap-2">
            <MapPin className="h-4 w-4" />
            Geographic
          </TabsTrigger>
        </TabsList>

        {/* Campaigns Tab */}
        <TabsContent value="campaigns">
          <Card>
            <CardHeader>
              <CardTitle>Campaign Performance</CardTitle>
              <CardDescription>
                Performance metrics by campaign for the last {period} days
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : campaigns.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No campaign data available</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Spend</TableHead>
                      <TableHead className="text-right">Clicks</TableHead>
                      <TableHead className="text-right">Conv.</TableHead>
                      <TableHead className="text-right">CPA</TableHead>
                      <TableHead className="text-right">CTR</TableHead>
                      <TableHead className="text-right">ROAS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.map((campaign) => (
                      <TableRow key={campaign.campaign_id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{campaign.campaign_name}</div>
                            <div className="text-xs text-muted-foreground">
                              {campaign.campaign_type}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={campaign.campaign_status} />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(campaign.spend)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(campaign.clicks)}
                        </TableCell>
                        <TableCell className="text-right">
                          {campaign.conversions?.toFixed(1) || "0"}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(campaign.cpa)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatPercent(campaign.ctr)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatRoas(campaign.roas)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Keywords Tab */}
        <TabsContent value="keywords">
          <Card>
            <CardHeader>
              <CardTitle>Top Keywords</CardTitle>
              <CardDescription>
                Top performing keywords by spend
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : keywords.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No keyword data available</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Keyword</TableHead>
                      <TableHead>Match</TableHead>
                      <TableHead>Campaign</TableHead>
                      <TableHead className="text-right">Spend</TableHead>
                      <TableHead className="text-right">Clicks</TableHead>
                      <TableHead className="text-right">Conv.</TableHead>
                      <TableHead className="text-right">QS</TableHead>
                      <TableHead className="text-right">CPA</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {keywords.slice(0, 20).map((keyword, idx) => (
                      <TableRow key={`${keyword.keyword_id}-${idx}`}>
                        <TableCell className="font-medium">
                          {keyword.keyword_text}
                        </TableCell>
                        <TableCell>
                          <MatchTypeBadge type={keyword.match_type} />
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {keyword.campaign_name}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(keyword.spend)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(keyword.clicks)}
                        </TableCell>
                        <TableCell className="text-right">
                          {keyword.conversions?.toFixed(1) || "0"}
                        </TableCell>
                        <TableCell className="text-right">
                          <QualityScoreBadge score={keyword.quality_score} />
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(keyword.cpa)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Geographic Tab */}
        <TabsContent value="geo">
          <Card>
            <CardHeader>
              <CardTitle>Geographic Performance</CardTitle>
              <CardDescription>
                Performance breakdown by location
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : geoData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No geographic data available</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Location</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Spend</TableHead>
                      <TableHead className="text-right">Clicks</TableHead>
                      <TableHead className="text-right">Conv.</TableHead>
                      <TableHead className="text-right">CTR</TableHead>
                      <TableHead className="text-right">CPA</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {geoData.map((geo, idx) => (
                      <TableRow key={`${geo.location_id}-${idx}`}>
                        <TableCell className="font-medium">
                          {geo.location_name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {geo.location_type}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(geo.spend)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(geo.clicks)}
                        </TableCell>
                        <TableCell className="text-right">
                          {geo.conversions?.toFixed(1) || "0"}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatPercent(geo.ctr)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(geo.cpa)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
