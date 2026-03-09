"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Save,
  Loader2,
  Monitor,
  Smartphone,
  Eye,
  Undo2,
  Redo2,
} from "lucide-react";
import { toast } from "sonner";
import { Suspense } from "react";
import type { EmailBuilderHandle } from "./email-builder";

// Dynamic import to avoid SSR issues with dnd-kit
const EmailBuilder = dynamic(() => import("./email-builder"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-slate-50">
      <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
    </div>
  ),
});

function BuilderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editorRef = useRef<EmailBuilderHandle | null>(null);

  const editId = searchParams.get("id");
  const returnTo = searchParams.get("return") || "/outreach/templates";

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!editId);
  const [templateName, setTemplateName] = useState("");
  const [subject, setSubject] = useState("");
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [existingDesign, setExistingDesign] = useState<Record<string, unknown> | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Load existing template if editing
  useEffect(() => {
    if (editId) {
      fetchTemplate(editId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const fetchTemplate = async (id: string) => {
    try {
      const res = await fetch(`/api/outreach/templates/${id}`);
      const data = await res.json();
      if (data.template) {
        setTemplateName(data.template.name);
        setSubject(data.template.subject);
        if (data.template.design_json) {
          setExistingDesign(data.template.design_json);
        }
      }
    } catch (error) {
      console.error("Failed to load template:", error);
      toast.error("Failed to load template");
    } finally {
      setLoading(false);
    }
  };

  const handleEditorReady = useCallback((handle: EmailBuilderHandle) => {
    editorRef.current = handle;
  }, []);

  const handleUndoRedo = useCallback((undo: boolean, redo: boolean) => {
    setCanUndo(undo);
    setCanRedo(redo);
  }, []);

  const handleUndo = () => editorRef.current?.undo();
  const handleRedo = () => editorRef.current?.redo();

  const getHtml = (): string => {
    if (!editorRef.current) return "";
    return editorRef.current.getHtml();
  };

  const getDesignJson = (): Record<string, unknown> => {
    if (!editorRef.current) return {};
    return editorRef.current.getDesignJson() as Record<string, unknown>;
  };

  const handlePreview = () => {
    const html = getHtml();
    if (html) {
      setPreviewHtml(html);
      setShowPreview(true);
    }
  };

  const handleSave = () => {
    if (!templateName.trim() || !subject.trim()) {
      setShowSaveDialog(true);
      return;
    }
    doSave();
  };

  const doSave = async () => {
    if (!templateName.trim()) {
      toast.error("Please enter a template name");
      return;
    }
    if (!subject.trim()) {
      toast.error("Please enter a subject line");
      return;
    }
    if (!editorRef.current) return;

    setSaving(true);
    setShowSaveDialog(false);

    try {
      const html = getHtml();
      const designJson = getDesignJson();

      const url = editId
        ? `/api/outreach/templates/${editId}`
        : "/api/outreach/templates";
      const method = editId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templateName.trim(),
          subject: subject.trim(),
          body: html,
          design_json: designJson,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Failed to save template");
      }

      toast.success(editId ? "Template updated" : "Template created");

      if (returnTo.includes("/outreach/new")) {
        const templateId = editId || result.template?.id;
        router.push(`${returnTo}${returnTo.includes("?") ? "&" : "?"}templateId=${templateId}`);
      } else {
        router.push(returnTo);
      }
    } catch (error) {
      console.error("Save error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateName, subject]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="fixed inset-0 z-50 flex flex-col bg-white">
        {/* Top Bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b bg-white z-10">
          {/* Left: Back + Name + Undo/Redo */}
          <div className="flex items-center gap-2">
            <Link href={returnTo}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <Input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Template name..."
              className="h-8 w-48 text-sm font-medium border-dashed"
            />
            {editId && (
              <Badge variant="secondary" className="text-xs">
                Editing
              </Badge>
            )}
            <div className="flex items-center gap-0.5 ml-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleUndo}
                    disabled={!canUndo}
                  >
                    <Undo2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleRedo}
                    disabled={!canRedo}
                  >
                    <Redo2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Redo (Ctrl+Y)</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Center: View toggle */}
          <div className="flex items-center gap-1">
            <div className="flex items-center border rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode("desktop")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === "desktop"
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Monitor className="h-3.5 w-3.5" />
                Desktop
              </button>
              <button
                onClick={() => setViewMode("mobile")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === "mobile"
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Smartphone className="h-3.5 w-3.5" />
                Mobile
              </button>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePreview} className="gap-1.5">
              <Eye className="h-3.5 w-3.5" />
              Preview & test
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save
            </Button>
          </div>
        </div>

        {/* Subject line bar */}
        <div className="flex items-center gap-3 px-4 py-2 border-b bg-slate-50">
          <Label className="text-xs font-medium text-muted-foreground shrink-0">Subject:</Label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Enter subject line... (supports {{variables}})"
            className="h-7 text-sm border-0 bg-transparent shadow-none focus-visible:ring-0 px-0"
          />
        </div>

        {/* Email Builder */}
        <div className="flex-1" style={{ minHeight: 0 }}>
          <EmailBuilder
            onEditor={handleEditorReady}
            existingDesign={existingDesign}
            onUndoRedo={handleUndoRedo}
          />
        </div>

        {/* Preview Modal */}
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Email Preview
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-auto border rounded-lg">
              <iframe
                srcDoc={previewHtml}
                title="Email Preview"
                className="w-full h-[600px] border-0"
                sandbox="allow-same-origin"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPreview(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Save Dialog */}
        <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Save Template</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="saveName">Template Name *</Label>
                <Input
                  id="saveName"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g., Product Launch Email"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="saveSubject">Subject Line *</Label>
                <Input
                  id="saveSubject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g., Check out our new {{last_product}}"
                />
                <p className="text-xs text-muted-foreground">
                  Supports variables: {"{{first_name}}"}, {"{{company}}"}, etc.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSaveDialog(false)}>Cancel</Button>
              <Button onClick={doSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Template
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

export default function TemplateBuilderPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <BuilderContent />
    </Suspense>
  );
}
