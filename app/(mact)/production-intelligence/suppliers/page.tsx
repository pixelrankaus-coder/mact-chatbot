"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Loader2,
  Pencil,
  Trash2,
  Upload,
  Download,
  Users,
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
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

// ─── Types ──────────────────────────────────────────────────────────────────

interface Supplier {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  is_active: boolean;
  material_count: number;
}

interface MaterialMapping {
  id: string;
  sku_id: string;
  material_name: string;
  is_preferred: boolean;
  lead_time_days: number;
  moq: number | null;
  order_multiple: number | null;
  unit_cost: number | null;
  notes: string | null;
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [materials, setMaterials] = useState<MaterialMapping[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [form, setForm] = useState({ name: "", contact_name: "", email: "", phone: "", notes: "" });
  const [saving, setSaving] = useState(false);

  // Material edit dialog
  const [materialDialogOpen, setMaterialDialogOpen] = useState(false);
  const [materialForm, setMaterialForm] = useState({
    sku_id: "",
    lead_time_days: "14",
    moq: "",
    order_multiple: "",
    unit_cost: "",
    notes: "",
  });
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);

  const fetchSuppliers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/production-intelligence/suppliers");
      if (res.ok) {
        const data = await res.json();
        setSuppliers(data.suppliers || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMaterials = async (supplierId: string) => {
    setLoadingMaterials(true);
    try {
      const res = await fetch(`/api/production-intelligence/suppliers/${supplierId}`);
      if (res.ok) {
        const data = await res.json();
        setMaterials(data.materials || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingMaterials(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setMaterials([]);
    } else {
      setExpandedId(id);
      fetchMaterials(id);
    }
  };

  const openNewDialog = () => {
    setEditingSupplier(null);
    setForm({ name: "", contact_name: "", email: "", phone: "", notes: "" });
    setDialogOpen(true);
  };

  const openEditDialog = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setForm({
      name: supplier.name,
      contact_name: supplier.contact_name || "",
      email: supplier.email || "",
      phone: supplier.phone || "",
      notes: supplier.notes || "",
    });
    setDialogOpen(true);
  };

  const saveSupplier = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editingSupplier) {
        await fetch(`/api/production-intelligence/suppliers/${editingSupplier.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ supplier: form }),
        });
      } else {
        await fetch("/api/production-intelligence/suppliers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      }
      setDialogOpen(false);
      await fetchSuppliers();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const deactivateSupplier = async (id: string) => {
    await fetch(`/api/production-intelligence/suppliers/${id}`, { method: "DELETE" });
    await fetchSuppliers();
  };

  const openMaterialDialog = (supplierId: string) => {
    setEditingSupplierId(supplierId);
    setMaterialForm({ sku_id: "", lead_time_days: "14", moq: "", order_multiple: "", unit_cost: "", notes: "" });
    setMaterialDialogOpen(true);
  };

  const saveMaterial = async () => {
    if (!materialForm.sku_id.trim() || !editingSupplierId) return;
    setSaving(true);
    try {
      await fetch(`/api/production-intelligence/suppliers/${editingSupplierId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materials: [{
            sku_id: materialForm.sku_id,
            lead_time_days: parseInt(materialForm.lead_time_days) || 14,
            moq: materialForm.moq ? parseFloat(materialForm.moq) : null,
            order_multiple: materialForm.order_multiple ? parseFloat(materialForm.order_multiple) : null,
            unit_cost: materialForm.unit_cost ? parseFloat(materialForm.unit_cost) : null,
            notes: materialForm.notes || null,
          }],
        }),
      });
      setMaterialDialogOpen(false);
      await fetchMaterials(editingSupplierId);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const handleCin7Import = async () => {
    setImporting(true);
    setImportResult(null);
    try {
      const res = await fetch("/api/production-intelligence/suppliers/import", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setImportResult(`Imported ${data.imported} suppliers (${data.skipped} already existed)`);
        await fetchSuppliers();
      } else {
        setImportResult(`Error: ${data.error}`);
      }
    } catch {
      setImportResult("Failed to import from Cin7");
    } finally {
      setImporting(false);
    }
  };

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const lines = text.split("\n").filter((l) => l.trim());
    if (lines.length < 2) return;

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const skuIdx = headers.indexOf("sku_id");
    const supplierIdx = headers.indexOf("supplier_name");
    const leadIdx = headers.indexOf("lead_time_days");
    const moqIdx = headers.indexOf("moq");
    const multIdx = headers.indexOf("order_multiple");
    const costIdx = headers.indexOf("unit_cost");

    if (skuIdx === -1 || supplierIdx === -1) {
      alert("CSV must have 'sku_id' and 'supplier_name' columns");
      return;
    }

    const supplierMaterials: Record<string, Array<Record<string, unknown>>> = {};
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c) => c.trim());
      const supplierName = cols[supplierIdx];
      if (!supplierName) continue;

      if (!supplierMaterials[supplierName]) supplierMaterials[supplierName] = [];
      supplierMaterials[supplierName].push({
        sku_id: cols[skuIdx],
        lead_time_days: leadIdx >= 0 ? parseInt(cols[leadIdx]) || 14 : 14,
        moq: moqIdx >= 0 && cols[moqIdx] ? parseFloat(cols[moqIdx]) : null,
        order_multiple: multIdx >= 0 && cols[multIdx] ? parseFloat(cols[multIdx]) : null,
        unit_cost: costIdx >= 0 && cols[costIdx] ? parseFloat(cols[costIdx]) : null,
      });
    }

    for (const [name, mats] of Object.entries(supplierMaterials)) {
      const createRes = await fetch("/api/production-intelligence/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (createRes.ok) {
        const { supplier } = await createRes.json();
        await fetch(`/api/production-intelligence/suppliers/${supplier.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ materials: mats }),
        });
      }
    }

    await fetchSuppliers();
    e.target.value = "";
  };

  // Stats
  const activeCount = suppliers.filter((s) => s.is_active).length;
  const totalMaterials = suppliers.reduce((sum, s) => sum + s.material_count, 0);
  const withContact = suppliers.filter((s) => s.email || s.phone).length;

  return (
    <div className="space-y-4">
      {/* Header — matches Sales Dashboard */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">Suppliers</h1>
          <p className="text-muted-foreground text-sm">Manage supplier details and raw material lead times</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCin7Import} disabled={importing}>
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            <span className="hidden sm:inline ml-2">Import from Cin7</span>
          </Button>
          <label>
            <input type="file" accept=".csv" className="hidden" onChange={handleCSVImport} />
            <Button variant="outline" size="sm" asChild>
              <span>
                <Upload className="h-4 w-4" />
                <span className="hidden sm:inline ml-2">CSV</span>
              </span>
            </Button>
          </label>
          <Button size="sm" onClick={openNewDialog}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline ml-2">Add Supplier</span>
          </Button>
        </div>
      </div>

      {/* Import result banner */}
      {importResult && (
        <div className={`rounded-md border p-3 text-sm ${importResult.startsWith("Error") ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300" : "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300"}`}>
          {importResult}
          <button className="ml-2 underline" onClick={() => setImportResult(null)}>dismiss</button>
        </div>
      )}

      {/* Metric cards — 2x2 grid like Sales Dashboard */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="space-y-1">
            <CardDescription>Total Suppliers</CardDescription>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="font-display text-2xl lg:text-3xl">{suppliers.length}</div>
            )}
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="space-y-1">
            <CardDescription>Active</CardDescription>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="font-display text-2xl lg:text-3xl">{activeCount}</span>
                {suppliers.length > 0 && (
                  <span className="text-muted-foreground text-xs">
                    {Math.round((activeCount / suppliers.length) * 100)}%
                  </span>
                )}
              </div>
            )}
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="space-y-1">
            <CardDescription>Materials Linked</CardDescription>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="font-display text-2xl lg:text-3xl">{totalMaterials}</div>
            )}
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="space-y-1">
            <CardDescription>With Contact Info</CardDescription>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="font-display text-2xl lg:text-3xl">{withContact}</span>
                <span className="text-muted-foreground text-xs">of {suppliers.length}</span>
              </div>
            )}
          </CardHeader>
        </Card>
      </div>

      {/* Supplier table — shadcn Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Suppliers</CardTitle>
          <CardDescription>
            {suppliers.length} supplier{suppliers.length !== 1 ? "s" : ""} configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && suppliers.length === 0 ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : suppliers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="text-muted-foreground/50 mb-3 h-10 w-10" />
              <p className="text-muted-foreground text-sm">No suppliers configured yet.</p>
              <p className="text-muted-foreground mt-1 text-xs">Import from Cin7, add manually, or upload a CSV.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="hidden md:table-cell">Contact</TableHead>
                  <TableHead className="hidden sm:table-cell">Email</TableHead>
                  <TableHead className="text-center">Materials</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((s) => (
                  <React.Fragment key={s.id}>
                    <TableRow
                      className={`cursor-pointer ${!s.is_active ? "opacity-50" : ""} ${expandedId === s.id ? "bg-muted/50" : ""}`}
                      onClick={() => toggleExpand(s.id)}
                    >
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-muted-foreground hidden md:table-cell">
                        {s.contact_name || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden sm:table-cell text-sm">
                        {s.email || "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        {s.material_count > 0 ? (
                          <Badge variant="secondary">{s.material_count}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={s.is_active ? "default" : "outline"}>
                          {s.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => { e.stopPropagation(); openEditDialog(s); }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {s.is_active && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:text-red-600"
                              onClick={(e) => { e.stopPropagation(); deactivateSupplier(s.id); }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Expanded materials row */}
                    {expandedId === s.id && (
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={6} className="p-4">
                          {s.notes && (
                            <p className="text-muted-foreground mb-3 text-sm italic">{s.notes}</p>
                          )}

                          {loadingMaterials ? (
                            <div className="space-y-2">
                              <Skeleton className="h-8 w-full" />
                              <Skeleton className="h-8 w-full" />
                            </div>
                          ) : materials.length === 0 ? (
                            <p className="text-muted-foreground py-2 text-sm">No materials linked to this supplier.</p>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-xs">Material</TableHead>
                                  <TableHead className="text-xs">SKU</TableHead>
                                  <TableHead className="text-right text-xs">Lead Time</TableHead>
                                  <TableHead className="text-right text-xs">MOQ</TableHead>
                                  <TableHead className="text-right text-xs">Multiple</TableHead>
                                  <TableHead className="text-right text-xs">Unit Cost</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {materials.map((m) => (
                                  <TableRow key={m.id}>
                                    <TableCell className="font-medium">{m.material_name}</TableCell>
                                    <TableCell className="text-muted-foreground">{m.sku_id}</TableCell>
                                    <TableCell className="text-right font-mono">{m.lead_time_days}d</TableCell>
                                    <TableCell className="text-right font-mono">{m.moq || "—"}</TableCell>
                                    <TableCell className="text-right font-mono">{m.order_multiple || "—"}</TableCell>
                                    <TableCell className="text-right font-mono">
                                      {m.unit_cost ? `$${m.unit_cost.toFixed(2)}` : "—"}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                          <div className="mt-3">
                            <Button variant="outline" size="sm" onClick={() => openMaterialDialog(s.id)}>
                              <Plus className="mr-1 h-3.5 w-3.5" />
                              Add Material
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Supplier Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSupplier ? "Edit Supplier" : "Add Supplier"}</DialogTitle>
            <DialogDescription>
              {editingSupplier ? "Update supplier details." : "Add a new supplier to the system."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Contact Name</Label>
              <Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveSupplier} disabled={saving || !form.name.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingSupplier ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Material Dialog */}
      <Dialog open={materialDialogOpen} onOpenChange={setMaterialDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Material Mapping</DialogTitle>
            <DialogDescription>
              Link a raw material SKU to this supplier with lead time and ordering details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Component SKU ID *</Label>
              <Input
                value={materialForm.sku_id}
                onChange={(e) => setMaterialForm({ ...materialForm, sku_id: e.target.value })}
                placeholder="Cin7 product ID for the raw material"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Lead Time (days)</Label>
                <Input
                  type="number"
                  value={materialForm.lead_time_days}
                  onChange={(e) => setMaterialForm({ ...materialForm, lead_time_days: e.target.value })}
                />
              </div>
              <div>
                <Label>MOQ</Label>
                <Input
                  type="number"
                  value={materialForm.moq}
                  onChange={(e) => setMaterialForm({ ...materialForm, moq: e.target.value })}
                  placeholder="Min order qty"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Order Multiple</Label>
                <Input
                  type="number"
                  value={materialForm.order_multiple}
                  onChange={(e) => setMaterialForm({ ...materialForm, order_multiple: e.target.value })}
                  placeholder="Order in multiples of..."
                />
              </div>
              <div>
                <Label>Unit Cost ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={materialForm.unit_cost}
                  onChange={(e) => setMaterialForm({ ...materialForm, unit_cost: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Input
                value={materialForm.notes}
                onChange={(e) => setMaterialForm({ ...materialForm, notes: e.target.value })}
                placeholder="e.g. seasonal availability"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMaterialDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveMaterial} disabled={saving || !materialForm.sku_id.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Add Material
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
