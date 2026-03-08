"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
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
  ImageIcon,
  Upload,
  X,
  Paperclip,
} from "lucide-react";

interface Attachment {
  url: string;
  filename: string;
  size: number;
  type: string;
}

interface FeatureRequest {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  submitted_by: string;
  affected_area: string | null;
  attachments: Attachment[];
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
  { value: "bug", label: "Bug Fix" },
  { value: "ui", label: "UI/UX" },
  { value: "integration", label: "Integration" },
  { value: "performance", label: "Performance" },
  { value: "other", label: "Other" },
];

const areaOptions = [
  { value: "", label: "Select area..." },
  { value: "dashboard", label: "Dashboard" },
  { value: "orders", label: "Orders" },
  { value: "customers", label: "Customers" },
  { value: "outreach", label: "Outreach / Email" },
  { value: "chat", label: "Live Chat" },
  { value: "settings", label: "Settings" },
  { value: "integrations", label: "Integrations" },
  { value: "shipping", label: "Shipping" },
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
  const [formAffectedArea, setFormAffectedArea] = useState("");
  const [formAttachments, setFormAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

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

  // Upload a file and return the attachment info
  const uploadFile = async (file: File): Promise<Attachment | null> => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/feature-requests/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Upload failed");
        return null;
      }

      return await res.json();
    } catch {
      alert("Upload failed — check your connection");
      return null;
    }
  };

  const handleFilesSelected = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setUploading(true);
    for (const file of fileArray) {
      const attachment = await uploadFile(file);
      if (attachment) {
        setFormAttachments((prev) => [...prev, attachment]);
      }
    }
    setUploading(false);
  };

  const handleRemoveAttachment = (index: number) => {
    setFormAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle paste event for screenshots
  useEffect(() => {
    if (!dialogOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        handleFilesSelected(imageFiles);
      }
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogOpen]);

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
          affected_area: formAffectedArea || null,
          attachments: formAttachments,
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
    setFormAffectedArea("");
    setFormAttachments([]);
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
            <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-lg">New Feature Request</DialogTitle>
                <DialogDescription>
                  Submit an idea, bug report, or feature request for the team.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-5 pt-2">
                {/* Title */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <Input
                    placeholder="e.g. Add bulk email import from CSV"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="text-base"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Description
                  </label>
                  <Textarea
                    placeholder="Describe the feature, why it's needed, steps to reproduce (for bugs), and any implementation ideas..."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    rows={8}
                    className="text-sm"
                  />
                </div>

                {/* Screenshots / Attachments */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Screenshots
                  </label>

                  {/* Upload zone */}
                  <div
                    ref={dropZoneRef}
                    className="relative rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center transition-colors hover:border-slate-400"
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.add("border-blue-400", "bg-blue-50");
                    }}
                    onDragLeave={(e) => {
                      e.currentTarget.classList.remove("border-blue-400", "bg-blue-50");
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove("border-blue-400", "bg-blue-50");
                      if (e.dataTransfer.files.length > 0) {
                        handleFilesSelected(e.dataTransfer.files);
                      }
                    }}
                  >
                    {uploading ? (
                      <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Uploading...
                      </div>
                    ) : (
                      <>
                        <Upload className="mx-auto h-8 w-8 text-slate-400" />
                        <p className="mt-2 text-sm text-slate-600">
                          Drag & drop images here, or{" "}
                          <button
                            type="button"
                            className="font-medium text-blue-600 hover:text-blue-700"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            browse files
                          </button>
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          PNG, JPG, GIF, WebP up to 5MB. You can also paste screenshots (Ctrl+V).
                        </p>
                      </>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/gif,image/webp"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files) handleFilesSelected(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </div>

                  {/* Attachment previews */}
                  {formAttachments.length > 0 && (
                    <div className="mt-3 grid grid-cols-3 gap-3">
                      {formAttachments.map((att, i) => (
                        <div
                          key={i}
                          className="group relative overflow-hidden rounded-lg border border-slate-200 bg-white"
                        >
                          <Image
                            src={att.url}
                            alt={att.filename}
                            width={200}
                            height={150}
                            className="h-32 w-full object-cover"
                            unoptimized
                          />
                          <button
                            type="button"
                            className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                            onClick={() => handleRemoveAttachment(i)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                          <p className="truncate px-2 py-1 text-xs text-slate-500">
                            {att.filename}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Category + Priority + Area */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
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
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
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
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Affected Area
                    </label>
                    <Select
                      value={formAffectedArea}
                      onValueChange={setFormAffectedArea}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select area..." />
                      </SelectTrigger>
                      <SelectContent>
                        {areaOptions.filter((a) => a.value).map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Submitted By */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Submitted By
                  </label>
                  <Input
                    placeholder="Your name (optional)"
                    value={formSubmittedBy}
                    onChange={(e) => setFormSubmittedBy(e.target.value)}
                  />
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 border-t pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={saving || !formTitle || uploading}
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
                const attachments = req.attachments || [];

                return (
                  <Card key={req.id} className="border-0 shadow-sm">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
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
                            {req.affected_area && (
                              <Badge variant="outline" className="text-xs text-slate-500">
                                {areaOptions.find(
                                  (a) => a.value === req.affected_area
                                )?.label || req.affected_area}
                              </Badge>
                            )}
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
                            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                              {req.description}
                            </p>
                          )}

                          {/* Attachments */}
                          {attachments.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {attachments.map((att, i) => (
                                <a
                                  key={i}
                                  href={att.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="group relative overflow-hidden rounded-lg border border-slate-200"
                                >
                                  <Image
                                    src={att.url}
                                    alt={att.filename}
                                    width={160}
                                    height={100}
                                    className="h-24 w-40 object-cover transition-opacity group-hover:opacity-80"
                                    unoptimized
                                  />
                                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1.5 py-0.5">
                                    <p className="flex items-center gap-1 truncate text-[10px] text-white">
                                      <Paperclip className="h-2.5 w-2.5" />
                                      {att.filename}
                                    </p>
                                  </div>
                                </a>
                              ))}
                            </div>
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
                            {attachments.length > 0 && (
                              <span className="flex items-center gap-1">
                                <ImageIcon className="h-3 w-3" />
                                {attachments.length} attachment{attachments.length !== 1 ? "s" : ""}
                              </span>
                            )}
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
