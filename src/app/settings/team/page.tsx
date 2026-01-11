"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SettingsSidebar } from "@/components/settings";
import { toast } from "sonner";
import {
  Users,
  UserPlus,
  Mail,
  MoreVertical,
  Shield,
  Crown,
  Search,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "agent";
  status: "active" | "pending" | "inactive";
  avatar?: string;
}

export default function TeamSettings() {
  const [searchQuery, setSearchQuery] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "agent">("agent");

  const [teamMembers] = useState<TeamMember[]>([
    {
      id: "1",
      name: "Drew Mitchell",
      email: "drew@mact.au",
      role: "owner",
      status: "active",
    },
    {
      id: "2",
      name: "Sarah Johnson",
      email: "sarah@mact.au",
      role: "admin",
      status: "active",
    },
    {
      id: "3",
      name: "Mike Chen",
      email: "mike@mact.au",
      role: "agent",
      status: "active",
    },
    {
      id: "4",
      name: "pending@example.com",
      email: "pending@example.com",
      role: "agent",
      status: "pending",
    },
  ]);

  const filteredMembers = teamMembers.filter(
    (member) =>
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleInvite = () => {
    if (!inviteEmail) {
      toast.error("Please enter an email address");
      return;
    }
    toast.success(`Invitation sent to ${inviteEmail}`);
    setInviteEmail("");
  };

  const getRoleBadge = (role: TeamMember["role"]) => {
    switch (role) {
      case "owner":
        return (
          <Badge className="bg-yellow-100 text-yellow-700">
            <Crown className="mr-1 h-3 w-3" />
            Owner
          </Badge>
        );
      case "admin":
        return (
          <Badge className="bg-purple-100 text-purple-700">
            <Shield className="mr-1 h-3 w-3" />
            Admin
          </Badge>
        );
      case "agent":
        return <Badge className="bg-slate-100 text-slate-700">Agent</Badge>;
    }
  };

  const getStatusBadge = (status: TeamMember["status"]) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-700">Active</Badge>;
      case "pending":
        return <Badge className="bg-orange-100 text-orange-700">Pending</Badge>;
      case "inactive":
        return <Badge className="bg-slate-100 text-slate-500">Inactive</Badge>;
    }
  };

  return (
    <div className="flex h-full">
      <SettingsSidebar />

      <div className="flex-1 overflow-auto bg-slate-50">
        <div className="border-b bg-white px-6 py-4">
          <h1 className="text-xl font-semibold text-slate-900">Team</h1>
          <p className="text-sm text-slate-500">
            Manage your team members and their permissions
          </p>
        </div>

        <div className="p-6">
          <div className="max-w-4xl space-y-6">
            {/* Invite Team Member */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <h3 className="mb-4 font-semibold text-slate-900">
                  <UserPlus className="mr-2 inline h-4 w-4" />
                  Invite Team Member
                </h3>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      type="email"
                      placeholder="Enter email address"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select
                    value={inviteRole}
                    onValueChange={(v: "admin" | "agent") => setInviteRole(v)}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="agent">Agent</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleInvite}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Send Invite
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Team Members List */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">
                    <Users className="mr-2 inline h-4 w-4" />
                    Team Members ({teamMembers.length})
                  </h3>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      placeholder="Search members..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-64 pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  {filteredMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={member.avatar} />
                          <AvatarFallback className="bg-blue-100 text-blue-600">
                            {member.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase()
                              .slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-slate-900">
                            {member.name}
                          </p>
                          <p className="text-sm text-slate-500">{member.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {getRoleBadge(member.role)}
                        {getStatusBadge(member.status)}
                        {member.role !== "owner" && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>Change Role</DropdownMenuItem>
                              <DropdownMenuItem>Resend Invite</DropdownMenuItem>
                              <DropdownMenuItem className="text-red-600">
                                Remove
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Role Permissions */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <h3 className="mb-4 font-semibold text-slate-900">
                  Role Permissions
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-3 rounded-lg bg-yellow-50 p-3">
                    <Crown className="mt-0.5 h-4 w-4 text-yellow-600" />
                    <div>
                      <p className="font-medium text-slate-900">Owner</p>
                      <p className="text-slate-600">
                        Full access including billing, team management, and all
                        settings
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg bg-purple-50 p-3">
                    <Shield className="mt-0.5 h-4 w-4 text-purple-600" />
                    <div>
                      <p className="font-medium text-slate-900">Admin</p>
                      <p className="text-slate-600">
                        Can manage team, settings, and view all conversations
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg bg-slate-50 p-3">
                    <Users className="mt-0.5 h-4 w-4 text-slate-600" />
                    <div>
                      <p className="font-medium text-slate-900">Agent</p>
                      <p className="text-slate-600">
                        Can respond to assigned conversations only
                      </p>
                    </div>
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
