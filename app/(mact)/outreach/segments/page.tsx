"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  Loader2,
  MoreVertical,
  Trash2,
  Edit2,
  ChevronDown,
  X,
  ArrowUpDown,
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
  created_at?: string;
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

const OPERATOR_OPTIONS: Record<string, { value: string; label: string }[]> = {
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
  boolean: [{ value: "eq", label: "is" }],
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
              <span className="text-xs font-medium text-muted-foreground w-8">AND</span>
            )}
            {idx === 0 && <span className="w-8" />}
            <Select value={rule.field} onValueChange={(v) => updateRule(idx, { field: v })}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_OPTIONS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={rule.operator} onValueChange={(v) => updateRule(idx, { operator: v })}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ops.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {needsValue && (
              <Input
                value={String(rule.value ?? "")}
                onChange={(e) =>
                  updateRule(idx, {
                    value: fieldType === "number" ? parseFloat(e.target.value) || 0 : e.target.value,
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
              className="h-8 w-8 text-muted-foreground hover:text-red-500"
              onClick={() => removeRule(idx)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        );
      })}
      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addRule}>
        <Plus className="h-3.5 w-3.5" />
        Add Rule
      </Button>
    </div>
  );
}

export default function ListsAndSegmentsPage() {
  const router = useRouter();
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<"name" | "count" | "created_at">("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Create/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"list" | "segment">("segment");
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formRules, setFormRules] = useState<SegmentRule[]>([]);
  const [saving, setSaving] = useState(false);

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
    } catch {
      toast.error("Failed to load segments");
    } finally {
      setLoading(false);
    }
  };

  // Filtered and sorted
  const filteredSegments = useMemo(() => {
    let list = segments;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) => s.name.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q)
      );
    }

    if (typeFilter === "list") {
      list = list.filter((s) => s.type === "static");
    } else if (typeFilter === "segment") {
      list = list.filter((s) => s.type === "dynamic");
    }

    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") cmp = a.name.localeCompare(b.name);
      else if (sortField === "count") cmp = a.count - b.count;
      else cmp = (a.created_at || "").localeCompare(b.created_at || "");
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [segments, searchQuery, typeFilter, sortField, sortDir]);

  const toggleSort = (field: "name" | "count" | "created_at") => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredSegments.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredSegments.map((s) => s.db_id || s.id)));
    }
  };

  const openCreateDialog = (mode: "list" | "segment") => {
    setDialogMode(mode);
    setEditingSegment(null);
    setFormName("");
    setFormDescription("");
    setFormRules(mode === "segment" ? [{ field: "total_spent", operator: "gte", value: 0 }] : []);
    setDialogOpen(true);
  };

  const openEditDialog = (segment: Segment) => {
    setDialogMode(segment.type === "static" ? "list" : "segment");
    setEditingSegment(segment);
    setFormName(segment.name);
    setFormDescription(segment.description);
    setFormRules(segment.rules || []);
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
        const res = await fetch(`/api/outreach/segments/${editingSegment.db_id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName,
            description: formDescription,
            rules: formRules,
          }),
        });
        if (!res.ok) throw new Error("Failed to update");
        toast.success(`${dialogMode === "list" ? "List" : "Segment"} updated`);
      } else {
        const res = await fetch("/api/outreach/segments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName,
            description: formDescription,
            type: dialogMode === "list" ? "static" : "dynamic",
            rules: formRules,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to create");
        }
        toast.success(`${dialogMode === "list" ? "List" : "Segment"} created`);
      }
      setDialogOpen(false);
      fetchSegments();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (dbId: string) => {
    if (!confirm("Are you sure you want to delete this?")) return;
    try {
      const res = await fetch(`/api/outreach/segments/${dbId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }
      toast.success("Deleted successfully");
      fetchSegments();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setTypeFilter("all");
  };

  const hasFilters = searchQuery || typeFilter !== "all";

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-AU", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Lists & segments</h1>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="gap-1">
                Create
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem onClick={() => openCreateDialog("list")} className="flex flex-col items-start gap-0.5 py-3">
                <span className="font-medium">List</span>
                <span className="text-xs text-muted-foreground">Static group of profiles</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openCreateDialog("segment")} className="flex flex-col items-start gap-0.5 py-3">
                <span className="font-medium">Segment</span>
                <span className="text-xs text-muted-foreground">Dynamic group of profiles based on conditions</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search"
            className="pl-10"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="list">List</SelectItem>
            <SelectItem value="segment">Segment</SelectItem>
          </SelectContent>
        </Select>
        {hasFilters && (
          <button onClick={clearFilters} className="text-sm text-blue-600 hover:underline">
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 px-4">
                <Checkbox
                  checked={selectedIds.size === filteredSegments.length && filteredSegments.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>
                <button onClick={() => toggleSort("name")} className="flex items-center gap-1 hover:text-foreground">
                  Name
                  {sortField === "name" && <ArrowUpDown className="h-3 w-3" />}
                </button>
              </TableHead>
              <TableHead>Type</TableHead>
              <TableHead>
                <button onClick={() => toggleSort("count")} className="flex items-center gap-1 hover:text-foreground">
                  Members
                  {sortField === "count" && <ArrowUpDown className="h-3 w-3" />}
                </button>
              </TableHead>
              <TableHead>
                <button onClick={() => toggleSort("created_at")} className="flex items-center gap-1 hover:text-foreground">
                  Created
                  {sortField === "created_at" && <ArrowUpDown className="h-3 w-3" />}
                </button>
              </TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSegments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  {hasFilters ? "No results found" : "No lists or segments yet"}
                </TableCell>
              </TableRow>
            ) : (
              filteredSegments.map((seg) => {
                const segId = seg.db_id || seg.id;
                return (
                  <TableRow key={segId} className="group">
                    <TableCell className="px-4">
                      <Checkbox
                        checked={selectedIds.has(segId)}
                        onCheckedChange={() => toggleSelect(segId)}
                      />
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => router.push(`/outreach/segments/${segId}`)}
                        className="text-blue-600 hover:underline font-medium text-left"
                      >
                        {seg.name}
                      </button>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {seg.type === "static" ? "List" : "Segment"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="tabular-nums">{seg.count.toLocaleString()}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(seg.created_at)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/outreach/segments/${segId}`)}>
                            View details
                          </DropdownMenuItem>
                          {seg.db_id && (
                            <>
                              <DropdownMenuItem onClick={() => openEditDialog(seg)}>
                                <Edit2 className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleDelete(seg.db_id!)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingSegment
                ? `Edit ${dialogMode === "list" ? "List" : "Segment"}`
                : `Create ${dialogMode === "list" ? "List" : "Segment"}`}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === "list"
                ? "A list is a static group of profiles. Add members manually or via CSV import."
                : "A segment dynamically groups profiles based on conditions you define."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={dialogMode === "list" ? "e.g., Newsletter Subscribers" : "e.g., High-Value Customers"}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder={dialogMode === "list" ? "e.g., Imported from Klaviyo" : "e.g., Customers who spent $10,000+"}
              />
            </div>
            {dialogMode === "segment" && (
              <div className="space-y-2">
                <Label>Conditions (all must match)</Label>
                <RuleEditor rules={formRules} onChange={setFormRules} />
                {formRules.length === 0 && (
                  <p className="text-xs text-muted-foreground">No conditions = matches all contacts</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingSegment ? "Save Changes" : `Create ${dialogMode === "list" ? "List" : "Segment"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
