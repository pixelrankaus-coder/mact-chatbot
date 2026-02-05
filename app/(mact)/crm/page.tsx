"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  DollarSign,
  Users,
  Target,
  TrendingUp,
  TrendingDown,
  Plus,
  Phone,
  Mail,
  Calendar,
  MoreHorizontal,
  ArrowRight,
} from "lucide-react";

// Mock KPI data
const kpiData = [
  {
    title: "Total Revenue",
    value: "$124,500",
    change: "+12.5%",
    trend: "up",
    description: "from last month",
    icon: DollarSign,
    iconBg: "bg-green-100",
    iconColor: "text-green-600",
  },
  {
    title: "Deals Closed",
    value: "48",
    change: "+8.2%",
    trend: "up",
    description: "from last month",
    icon: Target,
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
  },
  {
    title: "Conversion Rate",
    value: "24.8%",
    change: "+3.1%",
    trend: "up",
    description: "from last month",
    icon: TrendingUp,
    iconBg: "bg-purple-100",
    iconColor: "text-purple-600",
  },
  {
    title: "Active Leads",
    value: "156",
    change: "-2.4%",
    trend: "down",
    description: "from last month",
    icon: Users,
    iconBg: "bg-orange-100",
    iconColor: "text-orange-600",
  },
];

// Deal pipeline stages
const pipelineStages = [
  { name: "Lead", count: 45, value: "$89,000", color: "bg-slate-400" },
  { name: "Qualified", count: 32, value: "$156,000", color: "bg-blue-500" },
  { name: "Proposal", count: 18, value: "$234,000", color: "bg-purple-500" },
  { name: "Negotiation", count: 12, value: "$178,000", color: "bg-orange-500" },
  { name: "Closed Won", count: 8, value: "$124,500", color: "bg-green-500" },
];

// Recent leads data
const recentLeads = [
  {
    id: 1,
    name: "Sarah Johnson",
    company: "TechCorp Inc.",
    email: "sarah@techcorp.com",
    value: "$25,000",
    status: "qualified",
    source: "Website",
    date: "2 hours ago",
  },
  {
    id: 2,
    name: "Michael Chen",
    company: "StartupXYZ",
    email: "m.chen@startupxyz.io",
    value: "$15,000",
    status: "lead",
    source: "Referral",
    date: "5 hours ago",
  },
  {
    id: 3,
    name: "Emily Davis",
    company: "Global Solutions",
    email: "emily.d@globalsol.com",
    value: "$45,000",
    status: "proposal",
    source: "LinkedIn",
    date: "1 day ago",
  },
  {
    id: 4,
    name: "James Wilson",
    company: "DataFlow Ltd.",
    email: "jwilson@dataflow.co",
    value: "$32,000",
    status: "negotiation",
    source: "Cold Email",
    date: "2 days ago",
  },
  {
    id: 5,
    name: "Lisa Anderson",
    company: "Marketing Pro",
    email: "lisa@marketingpro.com",
    value: "$18,500",
    status: "qualified",
    source: "Event",
    date: "3 days ago",
  },
];

// Activity timeline
const activities = [
  {
    id: 1,
    type: "call",
    title: "Call with Sarah Johnson",
    description: "Discussed pricing options",
    time: "10:30 AM",
    icon: Phone,
  },
  {
    id: 2,
    type: "email",
    title: "Proposal sent to TechCorp",
    description: "Sent detailed proposal document",
    time: "9:15 AM",
  },
  {
    id: 3,
    type: "meeting",
    title: "Meeting scheduled",
    description: "Demo with StartupXYZ team",
    time: "Yesterday",
    icon: Calendar,
  },
  {
    id: 4,
    type: "email",
    title: "Follow-up email",
    description: "Sent to Global Solutions",
    time: "Yesterday",
    icon: Mail,
  },
];

const getStatusBadge = (status: string) => {
  const styles: Record<string, string> = {
    lead: "bg-slate-100 text-slate-700 border-slate-200",
    qualified: "bg-blue-100 text-blue-700 border-blue-200",
    proposal: "bg-purple-100 text-purple-700 border-purple-200",
    negotiation: "bg-orange-100 text-orange-700 border-orange-200",
    closed: "bg-green-100 text-green-700 border-green-200",
  };
  return styles[status] || styles.lead;
};

const getInitials = (name: string) => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
};

export default function CRMPage() {
  const totalPipelineValue = pipelineStages.reduce(
    (sum, stage) => sum + parseInt(stage.value.replace(/[$,]/g, "")),
    0
  );

  return (
    <div className="flex-1 overflow-auto bg-slate-50">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-white px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">CRM Dashboard</h1>
          <p className="text-sm text-slate-500">
            Manage your leads and track deal progress
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select defaultValue="30days">
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7days">Last 7 days</SelectItem>
              <SelectItem value="30days">Last 30 days</SelectItem>
              <SelectItem value="90days">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Lead
          </Button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {kpiData.map((kpi) => (
            <Card key={kpi.title} className="border-slate-200 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">{kpi.title}</p>
                    <p className="mt-1 text-2xl font-bold text-slate-900">{kpi.value}</p>
                    <div className="mt-1 flex items-center gap-1 text-sm">
                      {kpi.trend === "up" ? (
                        <TrendingUp className="h-4 w-4 text-green-500" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-500" />
                      )}
                      <span className={kpi.trend === "up" ? "text-green-600" : "text-red-600"}>
                        {kpi.change}
                      </span>
                      <span className="text-slate-400">{kpi.description}</span>
                    </div>
                  </div>
                  <div className={`rounded-full p-3 ${kpi.iconBg}`}>
                    <kpi.icon className={`h-6 w-6 ${kpi.iconColor}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Deal Pipeline */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Deal Pipeline</CardTitle>
                <CardDescription>
                  Total pipeline value: ${totalPipelineValue.toLocaleString()}
                </CardDescription>
              </div>
              <Button variant="outline" size="sm">
                View All Deals
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Pipeline Progress Bar */}
              <div className="flex h-4 overflow-hidden rounded-full">
                {pipelineStages.map((stage, index) => {
                  const percentage =
                    (parseInt(stage.value.replace(/[$,]/g, "")) / totalPipelineValue) * 100;
                  return (
                    <div
                      key={stage.name}
                      className={`${stage.color} ${index === 0 ? "rounded-l-full" : ""} ${
                        index === pipelineStages.length - 1 ? "rounded-r-full" : ""
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  );
                })}
              </div>

              {/* Pipeline Stages */}
              <div className="grid grid-cols-5 gap-4">
                {pipelineStages.map((stage) => (
                  <div key={stage.name} className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className={`h-3 w-3 rounded-full ${stage.color}`} />
                      <span className="text-sm font-medium text-slate-700">{stage.name}</span>
                    </div>
                    <p className="mt-1 text-lg font-semibold text-slate-900">{stage.count}</p>
                    <p className="text-xs text-slate-500">{stage.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Recent Leads Table */}
          <Card className="border-slate-200 shadow-sm lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Recent Leads</CardTitle>
                  <CardDescription>Latest leads added to your pipeline</CardDescription>
                </div>
                <Button variant="ghost" size="sm">
                  View All
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contact</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentLeads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-slate-100 text-xs font-medium">
                              {getInitials(lead.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-slate-900">{lead.name}</p>
                            <p className="text-xs text-slate-500">{lead.company}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{lead.value}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getStatusBadge(lead.status)}>
                          {lead.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-500">{lead.source}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Activity Timeline */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
              <CardDescription>Your latest CRM activities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activities.map((activity, index) => (
                  <div key={activity.id} className="flex gap-3">
                    <div className="relative flex flex-col items-center">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">
                        {activity.type === "call" && <Phone className="h-4 w-4 text-slate-600" />}
                        {activity.type === "email" && <Mail className="h-4 w-4 text-slate-600" />}
                        {activity.type === "meeting" && (
                          <Calendar className="h-4 w-4 text-slate-600" />
                        )}
                      </div>
                      {index < activities.length - 1 && (
                        <div className="mt-2 h-full w-px bg-slate-200" />
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="text-sm font-medium text-slate-900">{activity.title}</p>
                      <p className="text-xs text-slate-500">{activity.description}</p>
                      <p className="mt-1 text-xs text-slate-400">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="ghost" size="sm" className="mt-2 w-full">
                View All Activity
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
