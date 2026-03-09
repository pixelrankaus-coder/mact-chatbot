"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Filter,
  Plus,
  RefreshCw,
  Users,
  Trash2,
  Edit2,
  Loader2,
  Eye,
  X,
} from "lucide-react";
import { toast } from "sonner";

interface SegmentRule {
  field: string;
  operator: string;
  value: string | number | null;
}

interface Segment {
  id: string;
  db_id: string | null;
  name: string;
  description: string;
  type: string;
  rules: SegmentRule[];
  count: number;
  source: string;
  is_active: boolean;
}

const FIELD_OPTIONS = [
  { value: "total_spent", label: "Total Spent ($)", type: "number" },
  { value: "order_count", label: "Number of Orders", type: "number" },
  { value: "days_since_order", label: "Days Since Last Order", type: "number" },
  { value: "company", label: "Company", type: "string" },
  { value: "email", label: "Email", type: "string" },
  { value: "name", label: "Customer Name", type: "string" },
  { value: "last_product", label: "Last Product", type: "string" },
  { value: "payment_term", label: "Payment Term", type: "string" },
  { value: "source", label: "Data Source", type: "string" },
  { value: "is_subscribed", label: "Subscribed", type: "boolean" },
];

const OPERATOR_OPTIONS: Record<
  string,
  { value: string; label: string }[]
> = {
  number: [
    { value: "gt", label: "greater than" },
    { value: "gte", label: "greater than or equal" },
    { value: "lt", label: "less than" },
    { value: "lte", label: "less than or equal" },
    { value: "eq", label: "equals" },
    { value: "neq", label: "does not equal" },
  ],
  string: [
    { value: "eq", label: "equals" },
    { value: "neq", label: "does not equal" },
    { value: "contains", label: "contains" },
    { value: "not_contains", label: "does not contain" },
    { value: "is_empty", label: "is empty" },
    { value: "is_not_empty", label: "is not empty" },
  ],
  boolean: [
    { value: "eq", label: "is" },
  ],
};

function RuleEditor({
  rules,
  onChange,
}: {
  rules: SegmentRule[];
  onChange: (rules: SegmentRule[]) => void;
}) {
  const addRule = () => {
    onChange([...rules, { field: "total_spent", operator: "gte", value: 0 }]);
  };

  const updateRule = (index: number, updates: Partial<SegmentRule>) => {
    const newRules = [...rules];
    newRules[index] = { ...newRules[index], ...updates };
    // Reset operator when field type changes
    if (updates.field) {
      const fieldType = FIELD_OPTIONS.find((f) => f.value === updates.field)?.type || "string";
      const ops = OPERATOR_OPTIONS[fieldType] || OPERATOR_OPTIONS.string;
      if (!ops.find((o) => o.value === newRules[index].operator)) {
        newRules[index].operator = ops[0].value;
      }
    }
    onChange(newRules);
  };

  const removeRule = (index: number) => {
    onChange(rules.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      {rules.map((rule, idx) => {
        const fieldType = FIELD_OPTIONS.find((f) => f.value === rule.field)?.type || "string";
        const ops = OPERATOR_OPTIONS[fieldType] || OPERATOR_OPTIONS.string;
        const needsValue = !["is_empty", "is_not_empty"].includes(rule.operator);

        return (
          <div key={idx} className="flex items-center gap-2">
            {idx > 0 && (
              <span className="text-xs font-medium text-slate-400 w-8">AND</span>
            )}
            {idx === 0 && <span className="w-8" />}
            <Select
              value={rule.field}
              onValueChange={(v) => updateRule(idx, { field: v })}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_OPTIONS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={rule.operator}
              onValueChange={(v) => updateRule(idx, { operator: v })}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ops.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {needsValue && (
              <Input
                value={String(rule.value ?? "")}
                onChange={(e) =>
                  updateRule(idx, {
                    value:
                      fieldType === "number"
                        ? parseFloat(e.target.value) || 0
                        : e.target.value,
                  })
                }
                className="w-32"
                type={fieldType === "number" ? "number" : "text"}
                placeholder="Value"
              />
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-400 hover:text-red-500"
              onClick={() => removeRule(idx)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        );
      })}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={addRule}
      >
        <Plus className="h-3.5 w-3.5" />
        Add Rule
      </Button>
    </div>
  );
}

export default function SegmentsPage() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  // Create/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formRules, setFormRules] = useState<SegmentRule[]>([]);
  const [formType, setFormType] = useState("dynamic");
  const [saving, setSaving] = useState(false);

  // Members preview
  const [previewSegmentId, setPreviewSegmentId] = useState<string | null>(null);
  const [previewMembers, setPreviewMembers] = useState<
    Array<{ email: string; name: string; company: string }>
  >([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    fetchSegments();
  }, []);

  const fetchSegments = async () => {
    try {
      const res = await fetch("/api/outreach/segments");
      const data = await res.json();
      setSegments(
        (data.segments || []).filter((s: Segment) => s.type !== "custom")
      );
    } catch (error) {
      console.error("Failed to fetch segments:", error);
    } finally {
      setLoading(false);
    }
  };

  const refreshCount = async (dbId: string) => {
    setRefreshingId(dbId);
    try {
      const res = await fetch(
        `/api/outreach/segments/${dbId}?count=true&refresh=true`
      );
      const data = await res.json();
      setSegments((prev) =>
        prev.map((s) =>
          s.db_id === dbId ? { ...s, count: data.count } : s
        )
      );
      toast.success("Count refreshed");
    } catch {
      toast.error("Failed to refresh count");
    } finally {
      setRefreshingId(null);
    }
  };

  const openCreateDialog = () => {
    setEditingSegment(null);
    setFormName("");
    setFormDescription("");
    setFormRules([{ field: "total_spent", operator: "gte", value: 0 }]);
    setFormType("dynamic");
    setDialogOpen(true);
  };

  const openEditDialog = (segment: Segment) => {
    setEditingSegment(segment);
    setFormName(segment.name);
    setFormDescription(segment.description);
    setFormRules(segment.rules || []);
    setFormType(segment.type);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      if (editingSegment?.db_id) {
        // Update
        const res = await fetch(
          `/api/outreach/segments/${editingSegment.db_id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: formName,
              description: formDescription,
              rules: formRules,
            }),
          }
        );
        if (!res.ok) throw new Error("Failed to update");
        toast.success("Segment updated");
      } else {
        // Create
        const res = await fetch("/api/outreach/segments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName,
            description: formDescription,
            type: formType,
            rules: formRules,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to create");
        }
        toast.success("Segment created");
      }
      setDialogOpen(false);
      fetchSegments();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save segment"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (dbId: string) => {
    if (!confirm("Are you sure you want to delete this segment?")) return;
    try {
      const res = await fetch(`/api/outreach/segments/${dbId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }
      toast.success("Segment deleted");
      fetchSegments();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete"
      );
    }
  };

  const previewMembers_ = async (dbId: string) => {
    setPreviewSegmentId(dbId);
    setPreviewLoading(true);
    setPreviewMembers([]);
    try {
      const res = await fetch(
        `/api/outreach/segments/${dbId}?members=true`
      );
      const data = await res.json();
      setPreviewMembers(
        (data.members || []).slice(0, 50).map(
          (m: { email: string; name: string; company: string }) => ({
            email: m.email,
            name: m.name,
            company: m.company,
          })
        )
      );
    } catch {
      toast.error("Failed to load members");
    } finally {
      setPreviewLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Segments</h1>
          <p className="text-sm text-slate-500">
            Dynamic and static audience segments for campaigns and automations
          </p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          New Segment
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{segments.length}</div>
            <p className="text-xs text-slate-500">Total Segments</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {segments.filter((s) => s.type === "dynamic").length}
            </div>
            <p className="text-xs text-slate-500">Dynamic</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {segments.filter((s) => s.type === "static").length}
            </div>
            <p className="text-xs text-slate-500">Static / Imported</p>
          </CardContent>
        </Card>
      </div>

      {/* Segments Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            All Segments
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Rules</TableHead>
                <TableHead className="text-right">Members</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {segments.map((seg) => (
                <TableRow key={seg.db_id || seg.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{seg.name}</p>
                      {seg.description && (
                        <p className="text-xs text-slate-500">
                          {seg.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        seg.type === "dynamic" ? "default" : "secondary"
                      }
                      className="text-xs"
                    >
                      {seg.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {seg.rules && seg.rules.length > 0 ? (
                      <span className="text-xs text-slate-500">
                        {seg.rules.length} rule
                        {seg.rules.length !== 1 ? "s" : ""}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">
                        {seg.type === "dynamic" ? "All contacts" : "Manual list"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="tabular-nums font-medium">
                        {seg.count.toLocaleString()}
                      </span>
                      {seg.db_id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => refreshCount(seg.db_id!)}
                          disabled={refreshingId === seg.db_id}
                        >
                          <RefreshCw
                            className={`h-3 w-3 ${refreshingId === seg.db_id ? "animate-spin" : ""}`}
                          />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {seg.db_id && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => previewMembers_(seg.db_id!)}
                            title="Preview members"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEditDialog(seg)}
                            title="Edit"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-500 hover:text-red-700"
                            onClick={() => handleDelete(seg.db_id!)}
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingSegment ? "Edit Segment" : "Create Segment"}
            </DialogTitle>
            <DialogDescription>
              {editingSegment
                ? "Update the segment name, description, or rules."
                : "Define a dynamic segment with rules or create a static list."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., High-Value Customers"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="e.g., Customers who spent $10,000+"
              />
            </div>
            {formType === "dynamic" && (
              <div className="space-y-2">
                <Label>Rules (all must match)</Label>
                <RuleEditor rules={formRules} onChange={setFormRules} />
                {formRules.length === 0 && (
                  <p className="text-xs text-slate-400">
                    No rules = matches all contacts
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingSegment ? "Save Changes" : "Create Segment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Members Preview Dialog */}
      <Dialog
        open={!!previewSegmentId}
        onOpenChange={(open) => !open && setPreviewSegmentId(null)}
      >
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Segment Members
              {!previewLoading && (
                <Badge variant="secondary" className="ml-2">
                  {previewMembers.length}
                  {previewMembers.length >= 50 ? "+" : ""} shown
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {previewLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewMembers.map((m) => (
                  <TableRow key={m.email}>
                    <TableCell className="text-sm">{m.email}</TableCell>
                    <TableCell className="text-sm">{m.name || "—"}</TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {m.company || "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {previewMembers.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center text-slate-400 py-8"
                    >
                      No members found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
