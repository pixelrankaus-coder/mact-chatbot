import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  MessageSquare,
  Users,
  Clock,
  TrendingUp,
  Bot,
  CheckCircle,
} from "lucide-react";

const stats = [
  {
    title: "Total Conversations",
    value: "1,234",
    change: "+12%",
    icon: MessageSquare,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
  {
    title: "Active Visitors",
    value: "56",
    change: "+5%",
    icon: Users,
    color: "text-green-600",
    bgColor: "bg-green-50",
  },
  {
    title: "Avg. Response Time",
    value: "1.2m",
    change: "-18%",
    icon: Clock,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
  },
  {
    title: "AI Resolution Rate",
    value: "78%",
    change: "+8%",
    icon: Bot,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
  },
];

const recentConversations = [
  {
    id: 1,
    name: "John Smith",
    message: "Looking for GFRC panels pricing...",
    time: "2m ago",
    status: "active",
  },
  {
    id: 2,
    name: "Sarah Johnson",
    message: "Do you ship to California?",
    time: "15m ago",
    status: "resolved",
  },
  {
    id: 3,
    name: "Mike Wilson",
    message: "Need custom sizes for my project",
    time: "1h ago",
    status: "pending",
  },
  {
    id: 4,
    name: "Emily Davis",
    message: "What is the lead time for orders?",
    time: "2h ago",
    status: "resolved",
  },
];

const operatorStatus = [
  { name: "AI Agent", status: "online", conversations: 12 },
  { name: "Admin", status: "online", conversations: 3 },
];

export default function DashboardPage() {
  return (
    <div className="flex h-full">
      {/* Main Content */}
      <div className="flex-1 p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500">
            Welcome back! Here is what is happening with your chatbot.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.title} className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">{stat.title}</p>
                    <p className="mt-1 text-2xl font-bold text-slate-900">
                      {stat.value}
                    </p>
                    <div className="mt-1 flex items-center gap-1">
                      <TrendingUp className="h-3 w-3 text-green-600" />
                      <span className="text-xs text-green-600">
                        {stat.change}
                      </span>
                    </div>
                  </div>
                  <div className={`rounded-lg p-3 ${stat.bgColor}`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent Conversations */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">
              Recent Conversations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentConversations.map((conv) => (
                <div
                  key={conv.id}
                  className="flex items-center justify-between rounded-lg border border-slate-100 p-4 transition-colors hover:bg-slate-50"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-blue-100 text-blue-600">
                        {conv.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-slate-900">{conv.name}</p>
                      <p className="text-sm text-slate-500">{conv.message}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">{conv.time}</span>
                    <Badge
                      variant={
                        conv.status === "active"
                          ? "default"
                          : conv.status === "resolved"
                            ? "secondary"
                            : "outline"
                      }
                      className={
                        conv.status === "active"
                          ? "bg-green-100 text-green-700 hover:bg-green-100"
                          : conv.status === "resolved"
                            ? "bg-slate-100 text-slate-600"
                            : ""
                      }
                    >
                      {conv.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Sidebar - Status Panel */}
      <div className="w-72 border-l bg-white p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase text-slate-500">
          Team Status
        </h3>

        <div className="space-y-4">
          {operatorStatus.map((operator) => (
            <div
              key={operator.name}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback
                      className={
                        operator.name === "AI Agent"
                          ? "bg-purple-100 text-purple-600"
                          : "bg-blue-100 text-blue-600"
                      }
                    >
                      {operator.name === "AI Agent" ? (
                        <Bot className="h-4 w-4" />
                      ) : (
                        "A"
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <span
                    className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white ${
                      operator.status === "online"
                        ? "bg-green-500"
                        : "bg-slate-400"
                    }`}
                  />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {operator.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {operator.conversations} active
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <h3 className="mb-4 text-sm font-semibold uppercase text-slate-500">
            Quick Stats
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm text-slate-600">Resolved Today</span>
              </div>
              <span className="font-semibold text-slate-900">42</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-600" />
                <span className="text-sm text-slate-600">Pending</span>
              </div>
              <span className="font-semibold text-slate-900">8</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
