"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  Calendar,
  Flag,
  MoreHorizontal,
  Circle,
  CheckCircle2,
  Clock,
  ListTodo,
  Filter,
  SortAsc,
  Star,
  Trash2,
  Edit2,
} from "lucide-react";

type Priority = "low" | "medium" | "high" | "urgent";
type Status = "todo" | "in_progress" | "completed";

interface Task {
  id: string;
  title: string;
  description?: string;
  priority: Priority;
  status: Status;
  dueDate?: string;
  category: string;
  assignee?: {
    name: string;
    initials: string;
  };
  starred?: boolean;
}

const initialTasks: Task[] = [
  {
    id: "1",
    title: "Review Q1 marketing strategy",
    description: "Analyze performance metrics and adjust strategy for Q2",
    priority: "high",
    status: "todo",
    dueDate: "Feb 10, 2026",
    category: "Marketing",
    assignee: { name: "Sarah Chen", initials: "SC" },
    starred: true,
  },
  {
    id: "2",
    title: "Prepare board presentation",
    priority: "urgent",
    status: "in_progress",
    dueDate: "Feb 8, 2026",
    category: "Management",
    assignee: { name: "Alex Johnson", initials: "AJ" },
  },
  {
    id: "3",
    title: "Update team vacation calendar",
    priority: "low",
    status: "todo",
    dueDate: "Feb 15, 2026",
    category: "HR",
  },
  {
    id: "4",
    title: "Fix payment gateway integration",
    description: "Debug the recurring payment issue reported by users",
    priority: "urgent",
    status: "in_progress",
    dueDate: "Feb 7, 2026",
    category: "Development",
    assignee: { name: "Mike Peters", initials: "MP" },
    starred: true,
  },
  {
    id: "5",
    title: "Conduct user interviews",
    priority: "medium",
    status: "todo",
    dueDate: "Feb 12, 2026",
    category: "Research",
    assignee: { name: "Emma Wilson", initials: "EW" },
  },
  {
    id: "6",
    title: "Write blog post on new features",
    priority: "medium",
    status: "completed",
    dueDate: "Feb 5, 2026",
    category: "Content",
    assignee: { name: "Lisa Brown", initials: "LB" },
  },
  {
    id: "7",
    title: "Set up monitoring alerts",
    priority: "high",
    status: "completed",
    category: "DevOps",
    assignee: { name: "David Kim", initials: "DK" },
  },
  {
    id: "8",
    title: "Review security audit report",
    priority: "high",
    status: "todo",
    dueDate: "Feb 14, 2026",
    category: "Security",
  },
  {
    id: "9",
    title: "Plan team building event",
    priority: "low",
    status: "todo",
    dueDate: "Feb 20, 2026",
    category: "HR",
    assignee: { name: "Sarah Chen", initials: "SC" },
  },
  {
    id: "10",
    title: "Optimize database queries",
    description: "Improve performance for the dashboard loading times",
    priority: "medium",
    status: "in_progress",
    category: "Development",
    assignee: { name: "Mike Peters", initials: "MP" },
  },
];

const categories = [
  { name: "All Tasks", count: 10, color: "bg-slate-500" },
  { name: "Marketing", count: 1, color: "bg-pink-500" },
  { name: "Development", count: 2, color: "bg-blue-500" },
  { name: "Management", count: 1, color: "bg-purple-500" },
  { name: "HR", count: 2, color: "bg-green-500" },
  { name: "Research", count: 1, color: "bg-cyan-500" },
  { name: "Content", count: 1, color: "bg-orange-500" },
  { name: "DevOps", count: 1, color: "bg-emerald-500" },
  { name: "Security", count: 1, color: "bg-red-500" },
];

const priorityConfig: Record<Priority, { color: string; icon: string }> = {
  low: { color: "text-slate-400", icon: "bg-slate-100" },
  medium: { color: "text-blue-500", icon: "bg-blue-100" },
  high: { color: "text-orange-500", icon: "bg-orange-100" },
  urgent: { color: "text-red-500", icon: "bg-red-100" },
};

const statusConfig: Record<Status, { label: string; color: string }> = {
  todo: { label: "To Do", color: "bg-slate-100 text-slate-700" },
  in_progress: { label: "In Progress", color: "bg-blue-100 text-blue-700" },
  completed: { label: "Completed", color: "bg-green-100 text-green-700" },
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [selectedCategory, setSelectedCategory] = useState("All Tasks");
  const [searchQuery, setSearchQuery] = useState("");

  const toggleTaskStatus = (taskId: string) => {
    setTasks(
      tasks.map((task) =>
        task.id === taskId
          ? { ...task, status: task.status === "completed" ? "todo" : "completed" }
          : task
      )
    );
  };

  const toggleStarred = (taskId: string) => {
    setTasks(
      tasks.map((task) =>
        task.id === taskId ? { ...task, starred: !task.starred } : task
      )
    );
  };

  const filteredTasks = tasks.filter((task) => {
    const matchesCategory =
      selectedCategory === "All Tasks" || task.category === selectedCategory;
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const todoTasks = filteredTasks.filter((t) => t.status === "todo");
  const inProgressTasks = filteredTasks.filter((t) => t.status === "in_progress");
  const completedTasks = filteredTasks.filter((t) => t.status === "completed");

  const TaskItem = ({ task }: { task: Task }) => (
    <div
      className={`group flex items-start gap-3 rounded-lg border bg-white p-4 transition-all hover:shadow-sm ${
        task.status === "completed" ? "opacity-60" : ""
      }`}
    >
      <Checkbox
        checked={task.status === "completed"}
        onCheckedChange={() => toggleTaskStatus(task.id)}
        className="mt-1"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <h4
              className={`font-medium leading-snug ${
                task.status === "completed"
                  ? "text-slate-400 line-through"
                  : "text-slate-900"
              }`}
            >
              {task.title}
            </h4>
            {task.description && (
              <p className="mt-1 text-sm text-slate-500 line-clamp-1">
                {task.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => toggleStarred(task.id)}
            >
              <Star
                className={`h-4 w-4 ${
                  task.starred ? "fill-yellow-400 text-yellow-400" : "text-slate-400"
                }`}
              />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Edit2 className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className={priorityConfig[task.priority].icon}>
            <Flag className={`mr-1 h-3 w-3 ${priorityConfig[task.priority].color}`} />
            <span className="text-xs capitalize">{task.priority}</span>
          </Badge>
          <Badge variant="outline" className="text-xs">
            {task.category}
          </Badge>
          {task.dueDate && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Calendar className="h-3 w-3" />
              {task.dueDate}
            </span>
          )}
          {task.assignee && (
            <Avatar className="h-5 w-5">
              <AvatarFallback className="bg-slate-100 text-[9px] font-medium">
                {task.assignee.initials}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-full overflow-hidden bg-slate-50">
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0 border-r bg-white">
        <div className="p-4">
          <Button className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            New Task
          </Button>
        </div>
        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="px-3 py-2">
            <p className="mb-2 px-3 text-xs font-medium uppercase text-slate-400">
              Categories
            </p>
            {categories.map((category) => (
              <button
                key={category.name}
                onClick={() => setSelectedCategory(category.name)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                  selectedCategory === category.name
                    ? "bg-slate-100 text-slate-900 font-medium"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${category.color}`} />
                  <span>{category.name}</span>
                </div>
                <span className="text-xs text-slate-400">{category.count}</span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b bg-white px-6 py-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Tasks</h1>
            <p className="text-sm text-slate-500">
              {selectedCategory === "All Tasks"
                ? `${filteredTasks.length} total tasks`
                : `${filteredTasks.length} tasks in ${selectedCategory}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-[200px] pl-9"
              />
            </div>
            <Button variant="outline" size="sm">
              <Filter className="mr-2 h-4 w-4" />
              Filter
            </Button>
            <Button variant="outline" size="sm">
              <SortAsc className="mr-2 h-4 w-4" />
              Sort
            </Button>
          </div>
        </div>

        {/* Task Lists */}
        <ScrollArea className="h-[calc(100vh-180px)]">
          <div className="p-6 space-y-6">
            {/* To Do */}
            {todoTasks.length > 0 && (
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <Circle className="h-4 w-4 text-slate-400" />
                  <h2 className="font-semibold text-slate-700">To Do</h2>
                  <Badge variant="secondary" className="rounded-full">
                    {todoTasks.length}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {todoTasks.map((task) => (
                    <TaskItem key={task.id} task={task} />
                  ))}
                </div>
              </div>
            )}

            {/* In Progress */}
            {inProgressTasks.length > 0 && (
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-500" />
                  <h2 className="font-semibold text-slate-700">In Progress</h2>
                  <Badge variant="secondary" className="rounded-full">
                    {inProgressTasks.length}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {inProgressTasks.map((task) => (
                    <TaskItem key={task.id} task={task} />
                  ))}
                </div>
              </div>
            )}

            {/* Completed */}
            {completedTasks.length > 0 && (
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <h2 className="font-semibold text-slate-700">Completed</h2>
                  <Badge variant="secondary" className="rounded-full">
                    {completedTasks.length}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {completedTasks.map((task) => (
                    <TaskItem key={task.id} task={task} />
                  ))}
                </div>
              </div>
            )}

            {filteredTasks.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ListTodo className="h-12 w-12 text-slate-300" />
                <h3 className="mt-4 font-medium text-slate-900">No tasks found</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {searchQuery
                    ? "Try a different search term"
                    : "Create a new task to get started"}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
