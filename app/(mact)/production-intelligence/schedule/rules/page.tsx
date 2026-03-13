"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  Plus,
  Loader2,
  Trash2,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

// ─── Types ──────────────────────────────────────────────────────────────────

interface SchedulingRule {
  id: string;
  rule_type: string;
  sku_id: string | null;
  value_text: string | null;
  value_numeric: number | null;
  value_boolean: boolean | null;
  description: string | null;
  is_active: boolean;
}

const RULE_TYPES = [
  { value: "no_production_day", label: "No Production Day", field: "text" },
  { value: "daily_batch_capacity", label: "Daily Batch Capacity", field: "numeric" },
  { value: "sequence_before", label: "Sequence Before", field: "text" },
  { value: "changeover_penalty", label: "Changeover Penalty", field: "numeric" },
  { value: "max_days_ahead", label: "Max Days Ahead", field: "numeric" },
  { value: "priority_sku", label: "Priority SKU", field: "boolean" },
  { value: "min_batch_size", label: "Min Batch Size", field: "numeric" },
];

// ─── Component ──────────────────────────────────────────────────────────────

export default function SchedulingRulesPage() {
  const [rules, setRules] = useState<SchedulingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // New rule form
  const [showAdd, setShowAdd] = useState(false);
  const [newRuleType, setNewRuleType] = useState("");
  const [newValueText, setNewValueText] = useState("");
  const [newValueNumeric, setNewValueNumeric] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newSkuId, setNewSkuId] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchRules = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/production-intelligence/rules");
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const toggleActive = async (rule: SchedulingRule) => {
    setSaving(rule.id);
    try {
      await fetch("/api/production-intelligence/rules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rule.id, is_active: !rule.is_active }),
      });
      await fetchRules();
    } catch {
      // ignore
    } finally {
      setSaving(null);
    }
  };

  const deleteRule = async (id: string) => {
    setDeleting(id);
    try {
      await fetch("/api/production-intelligence/rules", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      await fetchRules();
    } catch {
      // ignore
    } finally {
      setDeleting(null);
    }
  };

  const addRule = async () => {
    if (!newRuleType) return;
    setAdding(true);
    try {
      const ruleConfig = RULE_TYPES.find((r) => r.value === newRuleType);
      await fetch("/api/production-intelligence/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rule_type: newRuleType,
          sku_id: newSkuId || null,
          value_text: ruleConfig?.field === "text" ? newValueText : null,
          value_numeric: ruleConfig?.field === "numeric" ? Number(newValueNumeric) : null,
          value_boolean: ruleConfig?.field === "boolean" ? true : null,
          description: newDescription || null,
        }),
      });
      // Reset form
      setNewRuleType("");
      setNewValueText("");
      setNewValueNumeric("");
      setNewDescription("");
      setNewSkuId("");
      setShowAdd(false);
      await fetchRules();
    } catch {
      // ignore
    } finally {
      setAdding(false);
    }
  };

  const selectedRuleConfig = RULE_TYPES.find((r) => r.value === newRuleType);

  // Group rules by type
  const grouped = new Map<string, SchedulingRule[]>();
  for (const rule of rules) {
    if (!grouped.has(rule.rule_type)) grouped.set(rule.rule_type, []);
    grouped.get(rule.rule_type)!.push(rule);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
            Scheduling Rules
          </h1>
          <p className="text-sm text-muted-foreground">
            Configure production scheduling constraints and preferences
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowAdd(!showAdd)}>
            <Plus className="h-4 w-4" />
            Add Rule
          </Button>
          <Button variant="outline" size="sm" onClick={fetchRules} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Add rule form */}
      {showAdd && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add New Rule</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Rule Type</label>
                <Select value={newRuleType} onValueChange={setNewRuleType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {RULE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedRuleConfig?.field === "text" && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Value</label>
                  <Input
                    placeholder="e.g., Saturday"
                    value={newValueText}
                    onChange={(e) => setNewValueText(e.target.value)}
                  />
                </div>
              )}
              {selectedRuleConfig?.field === "numeric" && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Value</label>
                  <Input
                    type="number"
                    placeholder="e.g., 8"
                    value={newValueNumeric}
                    onChange={(e) => setNewValueNumeric(e.target.value)}
                  />
                </div>
              )}

              {(newRuleType === "priority_sku" || newRuleType === "min_batch_size") && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">SKU ID</label>
                  <Input
                    placeholder="Cin7 product ID"
                    value={newSkuId}
                    onChange={(e) => setNewSkuId(e.target.value)}
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
                <Input
                  placeholder="Human-readable description"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={addRule} disabled={adding || !newRuleType}>
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Rule
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rules table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active Rules</CardTitle>
          <CardDescription>{rules.length} rules configured</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mx-auto" />
            </div>
          ) : rules.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No scheduling rules configured. Run the migration to seed defaults.
            </div>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-center">Active</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((rule) => (
                    <TableRow key={rule.id} className={!rule.is_active ? "opacity-50" : ""}>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-mono">
                          {rule.rule_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono">
                        {rule.value_text || rule.value_numeric?.toString() || (rule.value_boolean ? "true" : "—")}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {rule.sku_id || "All"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[250px] truncate">
                        {rule.description || "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={rule.is_active}
                          onCheckedChange={() => toggleActive(rule)}
                          disabled={saving === rule.id}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-red-600"
                          onClick={() => deleteRule(rule.id)}
                          disabled={deleting === rule.id}
                        >
                          {deleting === rule.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
