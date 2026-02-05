"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Briefcase,
  Award,
  Clock,
  TrendingUp,
  TrendingDown,
  Download,
  Calendar,
  Bell,
  Users,
  Star,
  FileText,
  ChevronRight,
} from "lucide-react";

// Mock data for KPI cards
const kpiData = [
  {
    title: "Total Revenue",
    value: "$45,231.89",
    change: "+20.1%",
    trend: "up",
    description: "from last month",
    icon: DollarSign,
    iconBg: "bg-green-100",
    iconColor: "text-green-600",
  },
  {
    title: "Active Projects",
    value: "24",
    change: "+5.02%",
    trend: "up",
    description: "from last month",
    icon: Briefcase,
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
  },
  {
    title: "New Leads",
    value: "3,500",
    change: "-3.58%",
    trend: "down",
    description: "from last month",
    icon: Award,
    iconBg: "bg-purple-100",
    iconColor: "text-purple-600",
  },
  {
    title: "Time Spent",
    value: "168h 40m",
    change: "+12.3%",
    trend: "up",
    description: "from last month",
    icon: Clock,
    iconBg: "bg-orange-100",
    iconColor: "text-orange-600",
  },
];

// Mock data for chart
const chartData = [
  { month: "Jan", projects: 12 },
  { month: "Feb", projects: 19 },
  { month: "Mar", projects: 15 },
  { month: "Apr", projects: 22 },
  { month: "May", projects: 18 },
  { month: "Jun", projects: 25 },
];

// Mock data for recent projects
const recentProjects = [
  {
    id: 1,
    name: "E-commerce Redesign",
    client: "TechCorp Inc.",
    startDate: "Jan 15, 2026",
    deadline: "Mar 30, 2026",
    status: "active",
    progress: 65,
  },
  {
    id: 2,
    name: "Mobile App Development",
    client: "StartupXYZ",
    startDate: "Dec 01, 2025",
    deadline: "Feb 28, 2026",
    status: "completed",
    progress: 100,
  },
  {
    id: 3,
    name: "Dashboard Analytics",
    client: "DataFlow Ltd.",
    startDate: "Jan 20, 2026",
    deadline: "Apr 15, 2026",
    status: "active",
    progress: 35,
  },
  {
    id: 4,
    name: "Brand Identity",
    client: "Fashion House",
    startDate: "Feb 01, 2026",
    deadline: "Feb 20, 2026",
    status: "pending",
    progress: 10,
  },
  {
    id: 5,
    name: "Website Migration",
    client: "OldSite Co.",
    startDate: "Jan 10, 2026",
    deadline: "Jan 25, 2026",
    status: "cancelled",
    progress: 45,
  },
  {
    id: 6,
    name: "API Integration",
    client: "ConnectHub",
    startDate: "Jan 25, 2026",
    deadline: "Mar 10, 2026",
    status: "active",
    progress: 50,
  },
];

// Mock data for reminders
const reminders = [
  {
    id: 1,
    title: "Team meeting with design department",
    time: "10:00 AM",
    priority: "high",
  },
  {
    id: 2,
    title: "Review project proposal for TechCorp",
    time: "2:00 PM",
    priority: "medium",
  },
  {
    id: 3,
    title: "Submit weekly progress report",
    time: "5:00 PM",
    priority: "low",
  },
];

// Mock data for team members
const teamMembers = [
  { name: "Alex Johnson", avatar: null, initials: "AJ" },
  { name: "Sarah Chen", avatar: null, initials: "SC" },
  { name: "Mike Peters", avatar: null, initials: "MP" },
  { name: "Emma Wilson", avatar: null, initials: "EW" },
  { name: "David Kim", avatar: null, initials: "DK" },
  { name: "Lisa Brown", avatar: null, initials: "LB" },
];

const getStatusBadge = (status: string) => {
  const styles: Record<string, string> = {
    active: "bg-green-100 text-green-700 border-green-200",
    completed: "bg-blue-100 text-blue-700 border-blue-200",
    pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
    cancelled: "bg-red-100 text-red-700 border-red-200",
  };
  return styles[status] || styles.pending;
};

const getPriorityColor = (priority: string) => {
  const colors: Record<string, string> = {
    high: "bg-red-500",
    medium: "bg-yellow-500",
    low: "bg-green-500",
  };
  return colors[priority] || colors.low;
};

export default function ProjectDashboardPage() {
  const maxProjects = Math.max(...chartData.map((d) => d.projects));

  return (
    <div className="flex-1 overflow-auto bg-slate-50">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-white px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Project Dashboard</h1>
          <p className="text-sm text-slate-500">
            Track your projects and team performance
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Calendar className="h-4 w-4" />
            <span>Jan 09, 2026 - Feb 05, 2026</span>
          </div>
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <div className="p-6">
        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="activities">Activities</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
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

            {/* Main Content Grid */}
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Projects Overview Chart */}
              <Card className="border-slate-200 shadow-sm lg:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">Projects Overview</CardTitle>
                    <CardDescription>Total for the last 6 months</CardDescription>
                  </div>
                  <Select defaultValue="6months">
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="6months">Last 6 months</SelectItem>
                      <SelectItem value="3months">Last 3 months</SelectItem>
                      <SelectItem value="30days">Last 30 days</SelectItem>
                    </SelectContent>
                  </Select>
                </CardHeader>
                <CardContent>
                  <div className="flex h-[200px] items-end gap-4">
                    {chartData.map((data) => (
                      <div key={data.month} className="flex flex-1 flex-col items-center gap-2">
                        <div
                          className="w-full rounded-t-md bg-blue-500 transition-all hover:bg-blue-600"
                          style={{ height: `${(data.projects / maxProjects) * 160}px` }}
                        />
                        <span className="text-xs text-slate-500">{data.month}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Reminders */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">Reminders</CardTitle>
                    <CardDescription>Today&apos;s tasks</CardDescription>
                  </div>
                  <Bell className="h-5 w-5 text-slate-400" />
                </CardHeader>
                <CardContent className="space-y-4">
                  {reminders.map((reminder) => (
                    <div key={reminder.id} className="flex items-start gap-3">
                      <div className={`mt-1.5 h-2 w-2 rounded-full ${getPriorityColor(reminder.priority)}`} />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-700">{reminder.title}</p>
                        <p className="text-xs text-slate-400">{reminder.time}</p>
                      </div>
                    </div>
                  ))}
                  <Button variant="ghost" size="sm" className="w-full text-blue-600 hover:text-blue-700">
                    Show all reminders
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Team and Stats */}
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Team Members */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-semibold">Team</CardTitle>
                      <CardDescription>Today&apos;s heroes</CardDescription>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4 text-slate-400" />
                      <span className="text-sm font-medium text-slate-600">12</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    {teamMembers.map((member) => (
                      <div key={member.name} className="flex flex-col items-center gap-1">
                        <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                          <AvatarImage src={member.avatar || undefined} />
                          <AvatarFallback className="bg-slate-100 text-xs font-medium text-slate-600">
                            {member.initials}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-slate-500">{member.name.split(" ")[0]}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 grid grid-cols-3 gap-4 border-t pt-4">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Star className="h-4 w-4 text-yellow-500" />
                        <span className="text-lg font-semibold text-slate-900">7.8</span>
                      </div>
                      <p className="text-xs text-slate-500">Avg. Rating</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <FileText className="h-4 w-4 text-blue-500" />
                        <span className="text-lg font-semibold text-slate-900">730</span>
                      </div>
                      <p className="text-xs text-slate-500">Avg. Quotes</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <DollarSign className="h-4 w-4 text-green-500" />
                        <span className="text-lg font-semibold text-slate-900">$2.3k</span>
                      </div>
                      <p className="text-xs text-slate-500">Avg. Earnings</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Projects Table */}
              <Card className="border-slate-200 shadow-sm lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Recent Projects</CardTitle>
                  <CardDescription>Latest project activities and status</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Project</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Deadline</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Progress</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentProjects.map((project) => (
                        <TableRow key={project.id}>
                          <TableCell className="font-medium">{project.name}</TableCell>
                          <TableCell className="text-slate-500">{project.client}</TableCell>
                          <TableCell className="text-slate-500">{project.deadline}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={getStatusBadge(project.status)}>
                              {project.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Progress value={project.progress} className="h-2 w-16" />
                              <span className="text-sm text-slate-500">{project.progress}%</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="reports">
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="flex h-[400px] items-center justify-center">
                <p className="text-slate-500">Reports content coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activities">
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="flex h-[400px] items-center justify-center">
                <p className="text-slate-500">Activities content coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
