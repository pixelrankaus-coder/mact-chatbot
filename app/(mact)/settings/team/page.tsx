"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Users,
  Plus,
  MoreHorizontal,
  Trash2,
  Edit2,
  Shield,
  ShieldCheck,
  User,
  Loader2,
  RefreshCw,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { useAgentOptional } from "@/contexts/AgentContext";

interface Agent {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  role: "owner" | "admin" | "agent";
  is_online: boolean;
  last_seen_at?: string;
  created_at: string;
}

const roleIcons = {
  owner: ShieldCheck,
  admin: Shield,
  agent: User,
};

const roleColors = {
  owner: "bg-purple-100 text-purple-700",
  admin: "bg-blue-100 text-blue-700",
  agent: "bg-slate-100 text-slate-700",
};

export default function TeamPage() {
  const agentContext = useAgentOptional();
  const currentAgent = agentContext?.agent;
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [saving, setSaving] = useState(false);

  const [newAgent, setNewAgent] = useState({
    name: "",
    email: "",
    password: "",
    role: "agent" as "owner" | "admin" | "agent",
  });

  const [editAgent, setEditAgent] = useState({
    name: "",
    role: "agent" as "owner" | "admin" | "agent",
    newPassword: "",
  });

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("agents")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Failed to load agents:", error);
      toast.error("Failed to load team members");
    } else {
      setAgents(data || []);
    }
    setLoading(false);
  };

  const canManageAgents = !currentAgent || currentAgent?.role === "owner" || currentAgent?.role === "admin";
  const canDeleteOwner = !currentAgent || currentAgent?.role === "owner";

  const handleAddAgent = async () => {
    if (!newAgent.name || !newAgent.email || !newAgent.password) {
      toast.error("Please fill in all fields");
      return;
    }

    if (newAgent.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setSaving(true);

    try {
      // Create auth user via API (server-side to use service role)
      const response = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newAgent.email,
          password: newAgent.password,
          name: newAgent.name,
          role: newAgent.role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create agent");
      }

      toast.success(`Agent ${newAgent.name} added successfully!`);
      setIsAddOpen(false);
      setNewAgent({ name: "", email: "", password: "", role: "agent" });
      loadAgents();
    } catch (error) {
      console.error("Failed to add agent:", error);
      toast.error(error instanceof Error ? error.message : "Failed to add agent");
    } finally {
      setSaving(false);
    }
  };

  const handleEditAgent = async () => {
    if (!selectedAgent || !editAgent.name) {
      toast.error("Please enter a name");
      return;
    }

    if (editAgent.newPassword && editAgent.newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setSaving(true);

    try {
      // Update agent record
      const { error } = await supabase
        .from("agents")
        .update({
          name: editAgent.name,
          role: editAgent.role,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedAgent.id);

      if (error) throw error;

      // Reset password if provided
      if (editAgent.newPassword) {
        const response = await fetch("/api/agents", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: selectedAgent.email,
            password: editAgent.newPassword,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Failed to reset password");
        }
        toast.success("Password updated successfully!");
      }

      toast.success("Agent updated successfully!");
      setIsEditOpen(false);
      setSelectedAgent(null);
      loadAgents();
    } catch (error) {
      console.error("Failed to update agent:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update agent");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAgent = async () => {
    if (!selectedAgent) return;

    setSaving(true);

    try {
      // Delete via API (server-side to handle auth user deletion)
      const response = await fetch(`/api/agents?id=${selectedAgent.id}&email=${selectedAgent.email}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete agent");
      }

      toast.success("Agent removed successfully");
      setIsDeleteOpen(false);
      setSelectedAgent(null);
      loadAgents();
    } catch (error) {
      console.error("Failed to delete agent:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete agent");
    } finally {
      setSaving(false);
    }
  };

  const openEditDialog = (agent: Agent) => {
    setSelectedAgent(agent);
    setEditAgent({ name: agent.name, role: agent.role, newPassword: "" });
    setIsEditOpen(true);
  };

  const openDeleteDialog = (agent: Agent) => {
    setSelectedAgent(agent);
    setIsDeleteOpen(true);
  };

  const formatLastSeen = (dateString?: string) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      <div className="flex-1 overflow-auto bg-slate-50">
        {/* Header */}
        <div className="flex items-center justify-between border-b bg-white px-6 py-4">
          <div>
            <Link href="/settings" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
              <ArrowLeft className="h-4 w-4" />
              Back to Settings
            </Link>
            <h1 className="text-xl font-semibold text-slate-900">Team</h1>
            <p className="text-sm text-slate-500">
              Manage your team members and their permissions
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={loadAgents}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            {canManageAgents && (
              <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2 bg-blue-600 hover:bg-blue-700">
                    <Plus className="h-4 w-4" />
                    Add Agent
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Agent</DialogTitle>
                    <DialogDescription>
                      Create a new team member account with access to the dashboard.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        placeholder="John Smith"
                        value={newAgent.name}
                        onChange={(e) =>
                          setNewAgent({ ...newAgent, name: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="john@company.com"
                        value={newAgent.email}
                        onChange={(e) =>
                          setNewAgent({ ...newAgent, email: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="Min 6 characters"
                        value={newAgent.password}
                        onChange={(e) =>
                          setNewAgent({ ...newAgent, password: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">Role</Label>
                      <Select
                        value={newAgent.role}
                        onValueChange={(value) =>
                          setNewAgent({
                            ...newAgent,
                            role: value as "owner" | "admin" | "agent",
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(canDeleteOwner) && (
                            <SelectItem value="owner">Owner</SelectItem>
                          )}
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="agent">Agent</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-slate-500">
                        {newAgent.role === "owner" && "Full access to all settings and team management"}
                        {newAgent.role === "admin" && "Can manage agents and settings"}
                        {newAgent.role === "agent" && "Can handle conversations only"}
                      </p>
                    </div>
                    <Button
                      onClick={handleAddAgent}
                      className="w-full"
                      disabled={saving}
                    >
                      {saving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        "Add Agent"
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="max-w-4xl space-y-6">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5 text-blue-600" />
                  Team Members
                </CardTitle>
                <CardDescription>
                  {agents.length} team member{agents.length !== 1 ? "s" : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                  </div>
                ) : agents.length === 0 ? (
                  <div className="py-12 text-center">
                    <Users className="mx-auto h-12 w-12 text-slate-300" />
                    <p className="mt-4 text-slate-500">No team members yet</p>
                    <p className="text-sm text-slate-400">
                      Add your first agent to get started
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Agent</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Active</TableHead>
                        {canManageAgents && <TableHead className="w-12"></TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {agents.map((agent) => {
                        const RoleIcon = roleIcons[agent.role];
                        const isCurrentUser = agent.id === currentAgent?.id;
                        const canEdit = canManageAgents && (canDeleteOwner || agent.role !== "owner");
                        const canDelete = canManageAgents && !isCurrentUser && (canDeleteOwner || agent.role !== "owner");

                        return (
                          <TableRow key={agent.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9">
                                  <AvatarFallback
                                    className={
                                      agent.role === "owner"
                                        ? "bg-purple-100 text-purple-700"
                                        : agent.role === "admin"
                                          ? "bg-blue-100 text-blue-700"
                                          : "bg-slate-100 text-slate-700"
                                    }
                                  >
                                    {getInitials(agent.name)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{agent.name}</span>
                                    {isCurrentUser && (
                                      <Badge variant="outline" className="text-xs">
                                        You
                                      </Badge>
                                    )}
                                  </div>
                                  <span className="text-sm text-slate-500">
                                    {agent.email}
                                  </span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className={`gap-1 ${roleColors[agent.role]}`}
                              >
                                <RoleIcon className="h-3 w-3" />
                                <span className="capitalize">{agent.role}</span>
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`h-2 w-2 rounded-full ${
                                    agent.is_online ? "bg-green-500" : "bg-slate-300"
                                  }`}
                                />
                                <span
                                  className={
                                    agent.is_online
                                      ? "text-green-600"
                                      : "text-slate-500"
                                  }
                                >
                                  {agent.is_online ? "Online" : "Offline"}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-slate-500">
                              {formatLastSeen(agent.last_seen_at)}
                            </TableCell>
                            {canManageAgents && (
                              <TableCell>
                                {(canEdit || canDelete) && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon">
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      {canEdit && (
                                        <DropdownMenuItem
                                          onClick={() => openEditDialog(agent)}
                                        >
                                          <Edit2 className="mr-2 h-4 w-4" />
                                          Edit
                                        </DropdownMenuItem>
                                      )}
                                      {canDelete && (
                                        <DropdownMenuItem
                                          onClick={() => openDeleteDialog(agent)}
                                          className="text-red-600 focus:text-red-600"
                                        >
                                          <Trash2 className="mr-2 h-4 w-4" />
                                          Remove
                                        </DropdownMenuItem>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Role Legend */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Role Permissions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-lg border p-4">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-purple-600" />
                      <span className="font-medium">Owner</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">
                      Full access. Can manage all settings, agents, and billing.
                    </p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <div className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-blue-600" />
                      <span className="font-medium">Admin</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">
                      Can manage settings and agents (except owners).
                    </p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <div className="flex items-center gap-2">
                      <User className="h-5 w-5 text-slate-600" />
                      <span className="font-medium">Agent</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">
                      Can handle conversations and view dashboard.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Agent</DialogTitle>
            <DialogDescription>
              Update agent details and permissions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editAgent.name}
                onChange={(e) =>
                  setEditAgent({ ...editAgent, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select
                value={editAgent.role}
                onValueChange={(value) =>
                  setEditAgent({
                    ...editAgent,
                    role: value as "owner" | "admin" | "agent",
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {canDeleteOwner && (
                    <SelectItem value="owner">Owner</SelectItem>
                  )}
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="agent">Agent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">Reset Password</Label>
              <Input
                id="edit-password"
                type="password"
                placeholder="Leave blank to keep current password"
                value={editAgent.newPassword}
                onChange={(e) =>
                  setEditAgent({ ...editAgent, newPassword: e.target.value })
                }
              />
              <p className="text-xs text-slate-500">
                Enter a new password (min 6 characters) or leave blank to keep the current one.
              </p>
            </div>
            <Button
              onClick={handleEditAgent}
              className="w-full"
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Agent</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {selectedAgent?.name}? This will
              revoke their access to the dashboard. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAgent}
              className="bg-red-600 hover:bg-red-700"
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Removing...
                </>
              ) : (
                "Remove"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
