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
  Send,
  Undo2,
  Redo2,
} from "lucide-react";
import { toast } from "sonner";
import { Suspense } from "react";

// Dynamic import Unlayer to avoid SSR issues
const EmailEditor = dynamic(
  () => import("react-email-editor").then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    ),
  }
);

// Default blank email design with MACt branding
const BLANK_EMAIL_DESIGN = {
  counters: {
    u_row: 3,
    u_column: 3,
    u_content_text: 2,
    u_content_image: 1,
    u_content_button: 1,
    u_content_divider: 1,
  },
  body: {
    id: "email",
    rows: [
      {
        id: "header_row",
        cells: [1],
        columns: [
          {
            id: "header_col",
            contents: [
              {
                id: "logo",
                type: "image",
                values: {
                  containerPadding: "20px 20px 10px",
                  src: {
                    url: "https://mact.au/wp-content/uploads/mact-logo-white.png",
                    width: 140,
                    height: 47,
                  },
                  textAlign: "center",
                  altText: "MACt",
                },
              },
            ],
            values: {
              backgroundColor: "#1a1a1a",
              padding: "0px",
              borderRadius: "8px 8px 0 0",
            },
          },
        ],
        values: { padding: "0px" },
      },
      {
        id: "body_row",
        cells: [1],
        columns: [
          {
            id: "body_col",
            contents: [
              {
                id: "body_text",
                type: "text",
                values: {
                  containerPadding: "30px 30px 20px",
                  textAlign: "left",
                  lineHeight: "160%",
                  text: '<p style="font-size: 15px; line-height: 160%; font-family: arial, helvetica, sans-serif;">Hi {{first_name}},</p><p style="font-size: 15px; line-height: 160%; font-family: arial, helvetica, sans-serif;">&nbsp;</p><p style="font-size: 15px; line-height: 160%; font-family: arial, helvetica, sans-serif;">Your email content goes here. Use the blocks on the left to add images, buttons, dividers and more.</p>',
                },
              },
            ],
            values: { backgroundColor: "#ffffff", padding: "0px" },
          },
        ],
        values: { padding: "0px" },
      },
      {
        id: "footer_row",
        cells: [1],
        columns: [
          {
            id: "footer_col",
            contents: [
              {
                id: "footer_divider",
                type: "divider",
                values: {
                  containerPadding: "10px 30px",
                  border: {
                    borderTopWidth: "1px",
                    borderTopStyle: "solid",
                    borderTopColor: "#e2e8f0",
                  },
                },
              },
              {
                id: "footer_text",
                type: "text",
                values: {
                  containerPadding: "10px 30px 20px",
                  textAlign: "center",
                  lineHeight: "150%",
                  text: '<p style="font-size: 12px; color: #94a3b8; font-family: arial, helvetica, sans-serif;">MACt &bull; Unit 3C, 919-925 Nudgee Road, Banyo QLD 4014</p>',
                },
              },
            ],
            values: { backgroundColor: "#f8fafc", padding: "0px", borderRadius: "0 0 8px 8px" },
          },
        ],
        values: { padding: "0px" },
      },
    ],
    values: {
      contentWidth: "600px",
      contentAlign: "center",
      fontFamily: { label: "Arial", value: "arial,helvetica,sans-serif" },
      textColor: "#333333",
      backgroundColor: "#f1f5f9",
      preheaderText: "",
      linkStyle: {
        body: true,
        linkColor: "#2563eb",
        linkHoverColor: "#1d4ed8",
        linkUnderline: true,
        linkHoverUnderline: true,
      },
    },
  },
  schemaVersion: 16,
};

interface EditorRef {
  editor?: {
    loadDesign: (design: Record<string, unknown>) => void;
    exportHtml: (
      callback: (data: { design: Record<string, unknown>; html: string }) => void
    ) => void;
    setBodyValues: (values: Record<string, unknown>) => void;
  };
}

// Merge tags for template variables
const MERGE_TAGS = {
  first_name: { name: "First Name", value: "{{first_name}}" },
  last_name: { name: "Last Name", value: "{{last_name}}" },
  company: { name: "Company", value: "{{company}}" },
  last_product: { name: "Last Product", value: "{{last_product}}" },
  last_order_date: { name: "Last Order Date", value: "{{last_order_date}}" },
  days_since_order: { name: "Days Since Order", value: "{{days_since_order}}" },
  total_spent: { name: "Total Spent", value: "{{total_spent}}" },
  order_count: { name: "Order Count", value: "{{order_count}}" },
  coupon_code: { name: "Coupon Code", value: "{{coupon_code}}" },
  order_number: { name: "Order Number", value: "{{order_number}}" },
  invoice_number: { name: "Invoice Number", value: "{{invoice_number}}" },
  invoice_total: { name: "Invoice Total", value: "{{invoice_total}}" },
  amount_due: { name: "Amount Due", value: "{{amount_due}}" },
};

function BuilderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailEditorRef = useRef<EditorRef>(null);

  const editId = searchParams.get("id");
  const returnTo = searchParams.get("return") || "/outreach/templates";

  const [editorReady, setEditorReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!editId);
  const [templateName, setTemplateName] = useState("");
  const [subject, setSubject] = useState("");
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [existingDesign, setExistingDesign] = useState<Record<string, unknown> | null>(null);

  // Load existing template if editing
  useEffect(() => {
    if (editId) {
      fetchTemplate(editId);
    }
  }, [editId]);

  // Load design into editor when ready
  useEffect(() => {
    if (editorReady && emailEditorRef.current?.editor) {
      if (existingDesign) {
        emailEditorRef.current.editor.loadDesign(existingDesign);
      } else if (!editId) {
        emailEditorRef.current.editor.loadDesign(BLANK_EMAIL_DESIGN as Record<string, unknown>);
      }
    }
  }, [editorReady, existingDesign, editId]);

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

  const onEditorReady = useCallback(() => {
    setEditorReady(true);
  }, []);

  const handlePreview = () => {
    if (!emailEditorRef.current?.editor) return;
    emailEditorRef.current.editor.exportHtml((data) => {
      setPreviewHtml(data.html);
      setShowPreview(true);
    });
  };

  const handleSave = () => {
    if (!templateName.trim()) {
      setShowSaveDialog(true);
      return;
    }
    if (!subject.trim()) {
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
    if (!emailEditorRef.current?.editor) return;

    setSaving(true);
    setShowSaveDialog(false);

    emailEditorRef.current.editor.exportHtml(async (data) => {
      try {
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
            body: data.html,
            design_json: data.design,
          }),
        });

        const result = await res.json();
        if (!res.ok) {
          throw new Error(result.error || "Failed to save template");
        }

        toast.success(editId ? "Template updated" : "Template created");

        // If returning to campaign wizard, pass the template ID
        if (returnTo.includes("/outreach/new")) {
          const templateId = editId || result.template?.id;
          router.push(`${returnTo}${returnTo.includes("?") ? "&" : "?"}templateId=${templateId}`);
        } else {
          router.push(returnTo);
        }
      } catch (error) {
        console.error("Save error:", error);
        toast.error(
          error instanceof Error ? error.message : "Failed to save"
        );
      } finally {
        setSaving(false);
      }
    });
  };

  const handleViewModeChange = (mode: "desktop" | "mobile") => {
    setViewMode(mode);
    if (emailEditorRef.current?.editor) {
      emailEditorRef.current.editor.setBodyValues({
        contentWidth: mode === "mobile" ? "375px" : "600px",
      });
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-white z-10">
        {/* Left: Back + Name */}
        <div className="flex items-center gap-3">
          <Link href={returnTo}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Template name..."
              className="h-8 w-56 text-sm font-medium border-dashed"
            />
            {editId && (
              <Badge variant="secondary" className="text-xs">
                Editing
              </Badge>
            )}
          </div>
        </div>

        {/* Center: View toggle */}
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium text-muted-foreground mr-2">Message</span>
          <div className="flex items-center border rounded-lg overflow-hidden">
            <button
              onClick={() => handleViewModeChange("desktop")}
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
              onClick={() => handleViewModeChange("mobile")}
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
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreview}
            className="gap-1.5"
          >
            <Eye className="h-3.5 w-3.5" />
            Preview & test
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="gap-1.5"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save
          </Button>
        </div>
      </div>

      {/* Subject line bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b bg-slate-50">
        <Label className="text-xs font-medium text-muted-foreground shrink-0">
          Subject:
        </Label>
        <Input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Enter subject line... (supports {{variables}})"
          className="h-7 text-sm border-0 bg-transparent shadow-none focus-visible:ring-0 px-0"
        />
      </div>

      {/* Unlayer Editor — fills remaining space. Unlayer needs explicit pixel height, not %. */}
      <div className="flex-1" style={{ minHeight: 0 }}>
        <EmailEditor
          ref={emailEditorRef}
          onReady={onEditorReady}
          minHeight="100%"
          style={{ height: "calc(100vh - 90px)" }}
          options={{
            displayMode: "email",
            projectId: undefined,
            features: {
              textEditor: {
                spellChecker: true,
              },
              undoRedo: true,
            },
            appearance: {
              theme: "light",
              panels: {
                tools: {
                  dock: "left",
                },
              },
            },
            mergeTags: MERGE_TAGS,
            designTags: {},
            specialLinks: [
              {
                name: "Unsubscribe",
                href: "{{unsubscribe_url}}",
                target: "_blank",
              },
            ],
            tools: {
              image: { enabled: true },
              text: { enabled: true },
              button: { enabled: true },
              divider: { enabled: true },
              html: { enabled: true },
              heading: { enabled: true },
              menu: { enabled: true },
              social: { enabled: true },
              video: { enabled: true },
              timer: { enabled: true },
            },
          }}
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
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Dialog (name + subject) */}
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
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={doSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
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
