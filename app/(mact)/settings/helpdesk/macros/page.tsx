"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  Loader2,
  MessageSquare,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { HelpdeskMacro } from "@/types/helpdesk";

export default function MacrosPage() {
  const [macros, setMacros] = useState<HelpdeskMacro[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingMacro, setEditingMacro] = useState<HelpdeskMacro | null>(null);
  const [deletingMacro, setDeletingMacro] = useState<HelpdeskMacro | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formShortcut, setFormShortcut] = useState("");
  const [formCategory, setFormCategory] = useState("");

  useEffect(() => {
    fetchMacros();
  }, []);

  const fetchMacros = async () => {
    try {
      const res = await fetch("/api/helpdesk/macros");
      if (res.ok) {
        const data = await res.json();
        setMacros(data);
      }
    } catch (error) {
      console.error("Failed to fetch macros:", error);
      toast.error("Failed to load macros");
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setFormName("");
    setFormContent("");
    setFormShortcut("");
    setFormCategory("");
    setEditingMacro(null);
    setShowCreateDialog(true);
  };

  const openEditDialog = (macro: HelpdeskMacro) => {
    setFormName(macro.name);
    setFormContent(macro.content);
    setFormShortcut(macro.shortcut || "");
    setFormCategory(macro.category || "");
    setEditingMacro(macro);
    setShowCreateDialog(true);
  };

  const saveMacro = async () => {
    if (!formName || !formContent) {
      toast.error("Name and content are required");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formName,
        content: formContent,
        shortcut: formShortcut || null,
        category: formCategory || null,
      };

      const res = editingMacro
        ? await fetch(`/api/helpdesk/macros/${editingMacro.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/helpdesk/macros", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      if (res.ok) {
        toast.success(editingMacro ? "Macro updated" : "Macro created");
        setShowCreateDialog(false);
        fetchMacros();
      } else {
        toast.error("Failed to save macro");
      }
    } catch (error) {
      console.error("Failed to save macro:", error);
      toast.error("Failed to save macro");
    } finally {
      setSaving(false);
    }
  };

  const deleteMacro = async () => {
    if (!deletingMacro) return;

    try {
      const res = await fetch(`/api/helpdesk/macros/${deletingMacro.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Macro deleted");
        setDeletingMacro(null);
        fetchMacros();
      } else {
        toast.error("Failed to delete macro");
      }
    } catch (error) {
      console.error("Failed to delete macro:", error);
      toast.error("Failed to delete macro");
    }
  };

  // Group macros by category
  const groupedMacros = macros.reduce((acc, macro) => {
    const category = macro.category || "Uncategorized";
    if (!acc[category]) acc[category] = [];
    acc[category].push(macro);
    return acc;
  }, {} as Record<string, HelpdeskMacro[]>);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/settings/helpdesk">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MessageSquare className="h-6 w-6" />
              Macros
            </h1>
            <p className="text-slate-500">
              Quick reply templates for common responses
            </p>
          </div>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          New Macro
        </Button>
      </div>

      {/* Macros List */}
      {macros.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="h-12 w-12 mx-auto text-slate-300 mb-4" />
            <h3 className="font-medium mb-2">No macros yet</h3>
            <p className="text-sm text-slate-500 mb-4">
              Create quick reply templates to speed up your responses
            </p>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Create your first macro
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedMacros).map(([category, categoryMacros]) => (
            <div key={category}>
              <h3 className="text-sm font-medium text-slate-500 mb-3">
                {category}
              </h3>
              <div className="space-y-2">
                {categoryMacros.map((macro) => (
                  <Card key={macro.id}>
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium">{macro.name}</h4>
                            {macro.shortcut && (
                              <Badge variant="secondary" className="text-xs">
                                {macro.shortcut}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-slate-500 line-clamp-2">
                            {macro.content}
                          </p>
                          <p className="text-xs text-slate-400 mt-2">
                            Used {macro.usage_count} times
                          </p>
                        </div>
                        <div className="flex items-center gap-1 ml-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(macro)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingMacro(macro)}
                            className="text-red-500 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingMacro ? "Edit Macro" : "Create Macro"}
            </DialogTitle>
            <DialogDescription>
              {editingMacro
                ? "Update this quick reply template"
                : "Create a new quick reply template"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Greeting"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Content</Label>
              <Textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder="Hi {{customer_name}}, thanks for reaching out!"
                className="mt-1 min-h-[100px]"
              />
              <p className="text-xs text-slate-500 mt-1">
                Use {"{{customer_name}}"} for personalization
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Shortcut (optional)</Label>
                <Input
                  value={formShortcut}
                  onChange={(e) => setFormShortcut(e.target.value)}
                  placeholder="/hi"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Category (optional)</Label>
                <Input
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  placeholder="General"
                  className="mt-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={saveMacro} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              {editingMacro ? "Save Changes" : "Create Macro"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingMacro}
        onOpenChange={() => setDeletingMacro(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Macro?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{deletingMacro?.name}&rdquo;? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteMacro}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
