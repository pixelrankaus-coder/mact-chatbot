"use client";

import { KanbanBoard } from "@/components/kanban";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Filter, Plus, UserPlus } from "lucide-react";

const teamMembers = [
  { name: "Alex K", initials: "AK" },
  { name: "Sarah M", initials: "SM" },
  { name: "John D", initials: "JD" },
  { name: "Lisa B", initials: "LB" },
];

export default function KanbanPage() {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-white px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Kanban Board</h1>
          <p className="text-sm text-slate-500">
            Manage and track your tasks visually
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Team Avatars */}
          <div className="flex items-center">
            <div className="flex -space-x-2">
              {teamMembers.map((member, idx) => (
                <Avatar key={idx} className="h-8 w-8 border-2 border-white">
                  <AvatarFallback className="bg-slate-100 text-xs font-medium text-slate-600">
                    {member.initials}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
            <Button variant="ghost" size="sm" className="ml-2 text-slate-500">
              <UserPlus className="mr-1 h-4 w-4" />
              Add Assignee
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input placeholder="Search tasks..." className="w-[180px] pl-9" />
          </div>

          {/* Filter */}
          <Button variant="outline" size="sm">
            <Filter className="mr-2 h-4 w-4" />
            Filters
          </Button>

          {/* Add Board */}
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Board
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b bg-white px-6">
        <Tabs defaultValue="board">
          <TabsList className="h-auto bg-transparent p-0">
            <TabsTrigger
              value="board"
              className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              Board
            </TabsTrigger>
            <TabsTrigger
              value="list"
              className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              List
            </TabsTrigger>
            <TabsTrigger
              value="table"
              className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              Table
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-auto p-6">
        <KanbanBoard />
      </div>
    </div>
  );
}
