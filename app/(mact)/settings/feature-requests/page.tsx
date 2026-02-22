"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Plus,
  Lightbulb,
  Trash2,
  Clock,
  ArrowUpCircle,
  CheckCircle2,
  XCircle,
  CircleDot,
  Loader2,
  StickyNote,
} from "lucide-react";

interface FeatureRequest {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  submitted_by: string;
  admin_notes: string;
  created_at: string;
  updated_at: string;
}

const statusConfig: Record<
  string,
  { label: string; color: string; icon: typeof CircleDot }
> = {
  new: {
    label: "New",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    icon: CircleDot,
  },
  planned: {
    label: "Planned",
    color: "bg-purple-100 text-purple-700 border-purple-200",
    icon: Clock,
  },
  in_progress: {
    label: "In Progress",
    color: "bg-amber-100 text-amber-700 border-amber-200",
    icon: Loader2,
  },
  completed: {
    label: "Completed",
    color: "bg-green-100 text-green-700 border-green-200",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Rejected",
    color: "bg-slate-100 text-slate-500 border-slate-200",
    icon: XCircle,
  },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  low: { label: "Low", color: "text-slate-500" },
  normal: { label: "Normal", color: "text-blue-600" },
  high: { label: "High", color: "text-red-600" },
};

const categoryOptions = [
  { value: "feature", label: "Feature" },
  { value: "ui", label: "UI/UX" },
  { value: "integration", label: "Integration" },
  { value: "performance", label: "Performance" },
  { value: "other", label: "Other" },
];

export default function FeatureRequestsPage() {
  const [requests, setRequests] = useState<FeatureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState("");

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState("feature");
  const [formPriority, setFormPriority] = useState("normal");
  const [formSubmittedBy, setFormSubmittedBy] = useState("");

  const fetchRequests = useCallback(async () => {
    try {
      const url =
        statusFilter !== "all"
          ? `/api/feature-requests?status=${statusFilter}`
          : "/api/feature-requests";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);
      } else {
        // API returned error (e.g. table doesn't exist) - show empty
        setRequests([]);
      }
    } catch {
      // Network error or table might not exist yet
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleSubmit = async () => {
    if (!formTitle) return;

    setSaving(true);
    try {
      const res = await fetch("/api/feature-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle,
          description: formDescription,
          category: formCategory,
          priority: formPriority,
          submitted_by: formSubmittedBy,
        }),
      });

      if (res.ok) {
        setDialogOpen(false);
        resetForm();
        fetchRequests();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to save. Make sure the database tables have been created.");
      }
    } catch (error) {
      console.error("Failed to create request:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/feature-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchRequests();
      }
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  };

  const handlePriorityChange = async (id: string, newPriority: string) => {
    try {
      const res = await fetch(`/api/feature-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority: newPriority }),
      });
      if (res.ok) {
        fetchRequests();
      }
    } catch (error) {
      console.error("Failed to update priority:", error);
    }
  };

  const handleSaveNotes = async (id: string) => {
    try {
      const res = await fetch(`/api/feature-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_notes: notesValue }),
      });
      if (res.ok) {
        setEditingNotes(null);
        fetchRequests();
      }
    } catch (error) {
      console.error("Failed to save notes:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this feature request?")) return;
    try {
      const res = await fetch(`/api/feature-requests/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchRequests();
      }
    } catch (error) {
      console.error("Failed to delete request:", error);
    }
  };

  const resetForm = () => {
    setFormTitle("");
    setFormDescription("");
    setFormCategory("feature");
    setFormPriority("normal");
    setFormSubmittedBy("");
  };

  // Stats
  const stats = {
    total: requests.length,
    new: requests.filter((r) => r.status === "new").length,
    planned: requests.filter((r) => r.status === "planned").length,
    in_progress: requests.filter((r) => r.status === "in_progress").length,
    completed: requests.filter((r) => r.status === "completed").length,
  };

  return (
    <div className="flex-1 overflow-auto bg-slate-50">
      <div className="border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <Link
              href="/settings"
              className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Settings
            </Link>
            <h1 className="text-xl font-semibold text-slate-900">
              Feature Requests
            </h1>
            <p className="text-sm text-slate-500">
              Track ideas and feature requests for MACt
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New Request
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>New Feature Request</DialogTitle>
                <DialogDescription>
                  Submit an idea or feature request for the team.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Title
                  </label>
                  <Input
                    placeholder="e.g. Add bulk email import from CSV"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Description
                  </label>
                  <Textarea
                    placeholder="Describe the feature, why it's needed, and any implementation ideas..."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    rows={4}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Category
                    </label>
                    <Select
                      value={formCategory}
                      onValueChange={setFormCategory}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categoryOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Priority
                    </label>
                    <Select
                      value={formPriority}
                      onValueChange={setFormPriority}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Submitted By
                  </label>
                  <Input
                    placeholder="Your name (optional)"
                    value={formSubmittedBy}
                    onChange={(e) => setFormSubmittedBy(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={saving || !formTitle}
                  >
                    {saving ? "Saving..." : "Submit Request"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="p-6">
        <div className="max-w-4xl space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {[
              { label: "Total", value: stats.total, color: "text-slate-900" },
              { label: "New", value: stats.new, color: "text-blue-600" },
              {
                label: "Planned",
                value: stats.planned,
                color: "text-purple-600",
              },
              {
                label: "In Progress",
                value: stats.in_progress,
                color: "text-amber-600",
              },
              {
                label: "Completed",
                value: stats.completed,
                color: "text-green-600",
              },
            ].map((stat) => (
              <Card key={stat.label} className="border-0 shadow-sm">
                <CardContent className="p-4 text-center">
                  <p className={`text-2xl font-bold ${stat.color}`}>
                    {stat.value}
                  </p>
                  <p className="text-xs text-slate-500">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-600">Filter:</span>
            {["all", "new", "planned", "in_progress", "completed", "rejected"].map(
              (status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? "default" : "outline"}
                  size="sm"
                  className="text-xs"
                  onClick={() => setStatusFilter(status)}
                >
                  {status === "all"
                    ? "All"
                    : status === "in_progress"
                      ? "In Progress"
                      : status.charAt(0).toUpperCase() + status.slice(1)}
                </Button>
              )
            )}
          </div>

          {/* Request List */}
          {loading ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-8 text-center text-slate-500">
                Loading feature requests...
              </CardContent>
            </Card>
          ) : requests.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
                <Lightbulb className="h-12 w-12 text-slate-300" />
                <h3 className="text-lg font-semibold text-slate-700">
                  No feature requests yet
                </h3>
                <p className="text-sm text-slate-500">
                  Click &quot;New Request&quot; to submit your first idea.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {requests.map((req) => {
                const statusInfo =
                  statusConfig[req.status] || statusConfig.new;
                const StatusIcon = statusInfo.icon;
                const priorityInfo =
                  priorityConfig[req.priority] || priorityConfig.normal;

                return (
                  <Card key={req.id} className="border-0 shadow-sm">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <Badge
                              variant="outline"
                              className={statusInfo.color}
                            >
                              <StatusIcon className="mr-1 h-3 w-3" />
                              {statusInfo.label}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {categoryOptions.find(
                                (c) => c.value === req.category
                              )?.label || req.category}
                            </Badge>
                            <span
                              className={`text-xs font-medium ${priorityInfo.color}`}
                            >
                              <ArrowUpCircle className="mr-0.5 inline h-3 w-3" />
                              {priorityInfo.label}
                            </span>
                          </div>
                          <h3 className="mt-2 text-base font-semibold text-slate-900">
                            {req.title}
                          </h3>
                          {req.description && (
                            <p className="mt-1 text-sm text-slate-600">
                              {req.description}
                            </p>
                          )}
                          <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
                            {req.submitted_by && (
                              <span>By {req.submitted_by}</span>
                            )}
                            <span>
                              {new Date(req.created_at).toLocaleDateString(
                                "en-AU",
                                {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                }
                              )}
                            </span>
                          </div>

                          {/* Admin Notes */}
                          {editingNotes === req.id ? (
                            <div className="mt-3 space-y-2">
                              <Textarea
                                placeholder="Add internal notes..."
                                value={notesValue}
                                onChange={(e) => setNotesValue(e.target.value)}
                                rows={2}
                                className="text-sm"
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleSaveNotes(req.id)}
                                >
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditingNotes(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : req.admin_notes ? (
                            <div
                              className="mt-3 cursor-pointer rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600"
                              onClick={() => {
                                setEditingNotes(req.id);
                                setNotesValue(req.admin_notes);
                              }}
                            >
                              <StickyNote className="mr-1 inline h-3 w-3 text-slate-400" />
                              {req.admin_notes}
                            </div>
                          ) : null}
                        </div>

                        {/* Actions */}
                        <div className="ml-4 flex flex-col gap-2">
                          <Select
                            value={req.status}
                            onValueChange={(v) =>
                              handleStatusChange(req.id, v)
                            }
                          >
                            <SelectTrigger className="h-8 w-32 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="new">New</SelectItem>
                              <SelectItem value="planned">Planned</SelectItem>
                              <SelectItem value="in_progress">
                                In Progress
                              </SelectItem>
                              <SelectItem value="completed">
                                Completed
                              </SelectItem>
                              <SelectItem value="rejected">Rejected</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select
                            value={req.priority}
                            onValueChange={(v) =>
                              handlePriorityChange(req.id, v)
                            }
                          >
                            <SelectTrigger className="h-8 w-32 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="normal">Normal</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                            </SelectContent>
                          </Select>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 flex-1 text-xs text-slate-400 hover:text-slate-600"
                              onClick={() => {
                                setEditingNotes(req.id);
                                setNotesValue(req.admin_notes || "");
                              }}
                            >
                              <StickyNote className="mr-1 h-3 w-3" />
                              Notes
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-slate-400 hover:text-red-500"
                              onClick={() => handleDelete(req.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
