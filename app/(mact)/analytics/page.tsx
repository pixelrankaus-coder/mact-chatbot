"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  Eye,
  Clock,
  MousePointerClick,
  TrendingUp,
  TrendingDown,
  Globe,
  Monitor,
  Smartphone,
  Tablet,
  Chrome,
  RefreshCw,
  ArrowUpRight,
  BarChart3,
  Activity,
} from "lucide-react";

// Mock data for the analytics dashboard
const kpiData = {
  activeUsers: { value: 3450, change: 12.1, trend: "up" as const },
  pageViews: { value: 24892, change: 8.4, trend: "up" as const },
  avgDuration: { value: "5m 23s", change: 7.7, trend: "up" as const },
  bounceRate: { value: "42.3%", change: -3.2, trend: "down" as const },
};

const topPages = [
  { path: "/", title: "Home", views: 8432, unique: 6234 },
  { path: "/products", title: "Products", views: 5621, unique: 4102 },
  { path: "/contact", title: "Contact", views: 3245, unique: 2891 },
  { path: "/about", title: "About Us", views: 2134, unique: 1876 },
  { path: "/blog", title: "Blog", views: 1892, unique: 1543 },
];

const trafficSources = [
  { source: "Organic Search", visitors: 12450, percentage: 42 },
  { source: "Direct", visitors: 8320, percentage: 28 },
  { source: "Referral", visitors: 4560, percentage: 15 },
  { source: "Social", visitors: 2980, percentage: 10 },
  { source: "Email", visitors: 1490, percentage: 5 },
];

const geoData = [
  { country: "Australia", flag: "🇦🇺", visitors: 18450, percentage: 62 },
  { country: "United States", flag: "🇺🇸", visitors: 4230, percentage: 14 },
  { country: "United Kingdom", flag: "🇬🇧", visitors: 2890, percentage: 10 },
  { country: "New Zealand", flag: "🇳🇿", visitors: 2150, percentage: 7 },
  { country: "Singapore", flag: "🇸🇬", visitors: 1280, percentage: 4 },
];

const deviceData = [
  { device: "Desktop", icon: Monitor, visitors: 17820, percentage: 60 },
  { device: "Mobile", icon: Smartphone, visitors: 9540, percentage: 32 },
  { device: "Tablet", icon: Tablet, visitors: 2380, percentage: 8 },
];

const browserData = [
  { browser: "Chrome", percentage: 58, color: "bg-blue-500" },
  { browser: "Safari", percentage: 24, color: "bg-purple-500" },
  { browser: "Firefox", percentage: 10, color: "bg-orange-500" },
  { browser: "Edge", percentage: 6, color: "bg-cyan-500" },
  { browser: "Other", percentage: 2, color: "bg-slate-400" },
];

// Simple bar chart visualization
const weeklyData = [
  { day: "Mon", visitors: 2450 },
  { day: "Tue", visitors: 3200 },
  { day: "Wed", visitors: 2890 },
  { day: "Thu", visitors: 3450 },
  { day: "Fri", visitors: 2980 },
  { day: "Sat", visitors: 1890 },
  { day: "Sun", visitors: 1650 },
];

const maxVisitors = Math.max(...weeklyData.map((d) => d.visitors));

export default function WebAnalyticsPage() {
  const [dateRange, setDateRange] = useState("7d");
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  };

  return (
    <div className="flex-1 overflow-auto bg-slate-50">
      {/* Header */}
      <div className="border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100">
              <BarChart3 className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Website Analytics
              </h1>
              <p className="text-sm text-slate-500">
                Track your website traffic and visitor behavior
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Last 24 hours</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Active Users */}
            <Card className="rounded-xl border-slate-200 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Active Users</p>
                    <p className="mt-1 text-2xl font-bold text-slate-900">
                      {kpiData.activeUsers.value.toLocaleString()}
                    </p>
                    <div className="mt-1 flex items-center gap-1">
                      <TrendingUp className="h-4 w-4 text-emerald-500" />
                      <span className="text-sm font-medium text-emerald-600">
                        +{kpiData.activeUsers.change}%
                      </span>
                      <span className="text-xs text-slate-400">vs last period</span>
                    </div>
                  </div>
                  <div className="rounded-full bg-blue-100 p-3">
                    <Users className="h-5 w-5 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Page Views */}
            <Card className="rounded-xl border-slate-200 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Page Views</p>
                    <p className="mt-1 text-2xl font-bold text-slate-900">
                      {kpiData.pageViews.value.toLocaleString()}
                    </p>
                    <div className="mt-1 flex items-center gap-1">
                      <TrendingUp className="h-4 w-4 text-emerald-500" />
                      <span className="text-sm font-medium text-emerald-600">
                        +{kpiData.pageViews.change}%
                      </span>
                      <span className="text-xs text-slate-400">vs last period</span>
                    </div>
                  </div>
                  <div className="rounded-full bg-violet-100 p-3">
                    <Eye className="h-5 w-5 text-violet-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Avg Duration */}
            <Card className="rounded-xl border-slate-200 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Avg. Duration</p>
                    <p className="mt-1 text-2xl font-bold text-slate-900">
                      {kpiData.avgDuration.value}
                    </p>
                    <div className="mt-1 flex items-center gap-1">
                      <TrendingUp className="h-4 w-4 text-emerald-500" />
                      <span className="text-sm font-medium text-emerald-600">
                        +{kpiData.avgDuration.change}%
                      </span>
                      <span className="text-xs text-slate-400">vs last period</span>
                    </div>
                  </div>
                  <div className="rounded-full bg-amber-100 p-3">
                    <Clock className="h-5 w-5 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Bounce Rate */}
            <Card className="rounded-xl border-slate-200 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Bounce Rate</p>
                    <p className="mt-1 text-2xl font-bold text-slate-900">
                      {kpiData.bounceRate.value}
                    </p>
                    <div className="mt-1 flex items-center gap-1">
                      <TrendingDown className="h-4 w-4 text-emerald-500" />
                      <span className="text-sm font-medium text-emerald-600">
                        {kpiData.bounceRate.change}%
                      </span>
                      <span className="text-xs text-slate-400">vs last period</span>
                    </div>
                  </div>
                  <div className="rounded-full bg-rose-100 p-3">
                    <MousePointerClick className="h-5 w-5 text-rose-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Weekly Traffic Chart */}
            <Card className="col-span-2 rounded-xl border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">Traffic Overview</CardTitle>
                    <CardDescription>Daily visitors for the past week</CardDescription>
                  </div>
                  <Tabs defaultValue="visitors" className="w-auto">
                    <TabsList className="h-8">
                      <TabsTrigger value="visitors" className="text-xs">Visitors</TabsTrigger>
                      <TabsTrigger value="pageviews" className="text-xs">Page Views</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="flex h-[200px] items-end gap-3">
                  {weeklyData.map((item) => (
                    <div key={item.day} className="flex flex-1 flex-col items-center gap-2">
                      <div className="relative w-full">
                        <div
                          className="w-full rounded-t-md bg-indigo-500 transition-all hover:bg-indigo-600"
                          style={{
                            height: `${(item.visitors / maxVisitors) * 160}px`,
                          }}
                        />
                      </div>
                      <span className="text-xs font-medium text-slate-500">{item.day}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-center gap-6 border-t pt-4">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-indigo-500" />
                    <span className="text-sm text-slate-600">
                      Total: <span className="font-semibold">18,510</span> visitors
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm text-slate-600">
                      Peak: <span className="font-semibold">Thursday</span>
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Traffic Sources */}
            <Card className="rounded-xl border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Traffic Sources</CardTitle>
                <CardDescription>Where your visitors come from</CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="space-y-4">
                  {trafficSources.map((source) => (
                    <div key={source.source} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-700">{source.source}</span>
                        <span className="text-slate-500">
                          {source.visitors.toLocaleString()} ({source.percentage}%)
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-indigo-500"
                          style={{ width: `${source.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Bottom Row */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Top Pages */}
            <Card className="rounded-xl border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">Top Pages</CardTitle>
                    <CardDescription>Most visited pages</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" className="gap-1 text-xs">
                    View all <ArrowUpRight className="h-3 w-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="space-y-3">
                  {topPages.map((page, index) => (
                    <div
                      key={page.path}
                      className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
                          {index + 1}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{page.title}</p>
                          <p className="text-xs text-slate-500">{page.path}</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="bg-slate-100">
                        {page.views.toLocaleString()}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Geography */}
            <Card className="rounded-xl border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">Visitors by Country</CardTitle>
                    <CardDescription>Geographic distribution</CardDescription>
                  </div>
                  <Globe className="h-5 w-5 text-slate-400" />
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="space-y-3">
                  {geoData.map((geo) => (
                    <div
                      key={geo.country}
                      className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{geo.flag}</span>
                        <span className="text-sm font-medium text-slate-900">{geo.country}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-600">
                          {geo.visitors.toLocaleString()}
                        </span>
                        <Badge variant="secondary" className="bg-slate-100 text-xs">
                          {geo.percentage}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Devices & Browsers */}
            <Card className="rounded-xl border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Devices & Browsers</CardTitle>
                <CardDescription>How visitors access your site</CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                {/* Devices */}
                <div className="mb-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Devices
                  </p>
                  <div className="space-y-2">
                    {deviceData.map((device) => {
                      const Icon = device.icon;
                      return (
                        <div
                          key={device.device}
                          className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3"
                        >
                          <div className="flex items-center gap-3">
                            <Icon className="h-4 w-4 text-slate-500" />
                            <span className="text-sm font-medium text-slate-900">
                              {device.device}
                            </span>
                          </div>
                          <Badge variant="secondary" className="bg-slate-100">
                            {device.percentage}%
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Browsers */}
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Browsers
                  </p>
                  <div className="flex h-3 w-full overflow-hidden rounded-full">
                    {browserData.map((browser) => (
                      <div
                        key={browser.browser}
                        className={`${browser.color}`}
                        style={{ width: `${browser.percentage}%` }}
                        title={`${browser.browser}: ${browser.percentage}%`}
                      />
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {browserData.map((browser) => (
                      <div key={browser.browser} className="flex items-center gap-1.5">
                        <div className={`h-2.5 w-2.5 rounded-full ${browser.color}`} />
                        <span className="text-xs text-slate-600">
                          {browser.browser} ({browser.percentage}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
