"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  ArrowLeft,
  Save,
  RotateCcw,
  Eye,
  Loader2,
  Mail,
  Clock,
  Forward,
  FileSignature,
  X,
  Plus,
  Pencil,
  Trash2,
  Copy,
} from "lucide-react";
import { toast } from "sonner";

// Dynamic import to avoid SSR issues with Unlayer
const EmailEditor = dynamic(
  () => import("react-email-editor").then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-[500px] bg-slate-100 rounded-lg">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    ),
  }
);

// Default blank signature design
const BLANK_SIGNATURE_DESIGN = {
  counters: { u_row: 2, u_column: 2, u_content_text: 2, u_content_image: 1 },
  body: {
    id: "signature",
    rows: [
      {
        id: "row1",
        cells: [1],
        columns: [
          {
            id: "col1",
            contents: [
              {
                id: "text1",
                type: "text",
                values: {
                  containerPadding: "10px",
                  textAlign: "left",
                  lineHeight: "140%",
                  text: '<p style="font-size: 14px; line-height: 140%; font-family: arial, helvetica, sans-serif;">Cheers,<br />Name</p>',
                },
              },
            ],
            values: { backgroundColor: "", padding: "0px" },
          },
        ],
        values: { padding: "0px" },
      },
      {
        id: "row2",
        cells: [1, 2],
        columns: [
          {
            id: "col2",
            contents: [
              {
                id: "image1",
                type: "image",
                values: {
                  containerPadding: "20px",
                  src: { url: "https://mact.au/wp-content/uploads/mact-logo-white.png", width: 120, height: 40 },
                  textAlign: "center",
                  altText: "MACt",
                },
              },
            ],
            values: { backgroundColor: "#1a1a1a", padding: "10px", borderRadius: "8px 0 0 8px" },
          },
          {
            id: "col3",
            contents: [
              {
                id: "text2",
                type: "text",
                values: {
                  containerPadding: "20px",
                  textAlign: "left",
                  lineHeight: "160%",
                  text: `<p style="font-size: 13px; line-height: 160%; color: #ffffff; font-family: arial, helvetica, sans-serif;"><strong style="font-size: 15px;">Full Name</strong><br /><span style="color: #999999;">Title</span><br /><br />Office 07 3111 4047<br /><a rel="noopener" href="mailto:email@mact.au" target="_blank" style="color: #00b4b4;">email@mact.au</a><br />Unit 3C, 919-925 Nudgee Road,<br />Banyo, QLD 4014</p>`,
                },
              },
            ],
            values: { backgroundColor: "#1a1a1a", padding: "10px", borderRadius: "0 8px 8px 0" },
          },
        ],
        values: { padding: "10px 0" },
      },
    ],
    values: {
      contentWidth: "600px",
      fontFamily: { label: "Arial", value: "arial,helvetica,sans-serif" },
      textColor: "#000000",
      backgroundColor: "#ffffff",
    },
  },
  schemaVersion: 16,
};

interface OutreachSettings {
  id: string;
  default_from_name: string;
  default_from_email: string;
  default_reply_to: string;
  forward_replies: boolean;
  forward_replies_to: string;
  max_emails_per_hour: number;
  send_window_start: string;
  send_window_end: string;
  timezone: string;
  signature_html: string;
  signature_json: Record<string, unknown> | null;
  automation_signature_html: string;
  automation_signature_json: Record<string, unknown> | null;
  default_signature_id?: string | null;
  automation_signature_id?: string | null;
}

interface Signature {
  id: string;
  name: string;
  signature_html: string;
  signature_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

const TIMEZONE_OPTIONS = [
  { value: "Australia/Melbourne", label: "Melbourne (AEST/AEDT)" },
  { value: "Australia/Sydney", label: "Sydney (AEST/AEDT)" },
  { value: "Australia/Brisbane", label: "Brisbane (AEST)" },
  { value: "Australia/Perth", label: "Perth (AWST)" },
  { value: "Australia/Adelaide", label: "Adelaide (ACST/ACDT)" },
  { value: "Pacific/Auckland", label: "Auckland (NZST/NZDT)" },
];

const getTimezoneLabel = (tz: string) => {
  const option = TIMEZONE_OPTIONS.find((o) => o.value === tz);
  return option ? option.label.split(" (")[0] : tz;
};

const defaultSettings: Omit<OutreachSettings, "id"> = {
  default_from_name: "Chris Born",
  default_from_email: "c.born@mact.au",
  default_reply_to: "c.born@reply.mact.au",
  forward_replies: true,
  forward_replies_to: "c.born@mact.au",
  max_emails_per_hour: 50,
  send_window_start: "09:00",
  send_window_end: "17:00",
  timezone: "Australia/Melbourne",
  signature_html: "",
  signature_json: null,
  automation_signature_html: "",
  automation_signature_json: null,
};

interface EditorRef {
  editor?: {
    loadDesign: (design: Record<string, unknown>) => void;
    exportHtml: (callback: (data: { design: Record<string, unknown>; html: string }) => void) => void;
  };
}

export default function OutreachSettingsPage() {
  const emailEditorRef = useRef<EditorRef>(null);
  const [settings, setSettings] = useState<OutreachSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState("general");

  // Signature library state
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [editingSignature, setEditingSignature] = useState<Signature | null>(null);
  const [defaultSigId, setDefaultSigId] = useState<string | null>(null);
  const [automationSigId, setAutomationSigId] = useState<string | null>(null);
  const [sigSaving, setSigSaving] = useState(false);
  const [sigDeleting, setSigDeleting] = useState<string | null>(null);
  const [newSigName, setNewSigName] = useState("");
  const [showNewSigForm, setShowNewSigForm] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  // Load signature design into editor when editing changes
  useEffect(() => {
    if (editorReady && editingSignature && emailEditorRef.current?.editor) {
      const design = editingSignature.signature_json || BLANK_SIGNATURE_DESIGN;
      emailEditorRef.current.editor.loadDesign(design);
    }
  }, [editorReady, editingSignature]);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/outreach/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings({ ...defaultSettings, ...data });
        setDefaultSigId(data.default_signature_id || null);
        setAutomationSigId(data.automation_signature_id || null);
      } else {
        setSettings({ id: "", ...defaultSettings });
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
      toast.error("Failed to load settings");
      setSettings({ id: "", ...defaultSettings });
    } finally {
      setLoading(false);
    }
    // Also fetch signatures
    fetchSignatures();
  };

  const fetchSignatures = useCallback(async () => {
    try {
      const res = await fetch("/api/outreach/signatures");
      if (res.ok) {
        const data = await res.json();
        setSignatures(data.signatures || []);
        if (data.default_signature_id) setDefaultSigId(data.default_signature_id);
        if (data.automation_signature_id) setAutomationSigId(data.automation_signature_id);
      }
    } catch (error) {
      console.error("Failed to fetch signatures:", error);
    }
  }, []);

  const handleSaveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch("/api/outreach/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        toast.success("Settings saved successfully");
      } else {
        const error = await res.json();
        toast.error(error.message || "Failed to save settings");
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof OutreachSettings>(
    key: K,
    value: OutreachSettings[K]
  ) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  };

  const onEditorReady = () => {
    setEditorReady(true);
  };

  // --- Signature CRUD ---

  const handleCreateSignature = async () => {
    if (!newSigName.trim()) {
      toast.error("Please enter a name");
      return;
    }
    setSigSaving(true);
    try {
      const res = await fetch("/api/outreach/signatures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newSigName.trim(),
          signature_html: "",
          signature_json: BLANK_SIGNATURE_DESIGN,
        }),
      });
      if (res.ok) {
        const sig = await res.json();
        setSignatures((prev) => [...prev, sig]);
        setNewSigName("");
        setShowNewSigForm(false);
        // Auto-open the editor for the new signature
        setEditingSignature(sig);
        toast.success(`Signature "${sig.name}" created`);
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to create signature");
      }
    } catch {
      toast.error("Failed to create signature");
    } finally {
      setSigSaving(false);
    }
  };

  const handleSaveSignature = async () => {
    if (!editingSignature || !emailEditorRef.current?.editor) return;
    setSigSaving(true);

    emailEditorRef.current.editor.exportHtml(async (data) => {
      const { design, html } = data;
      try {
        const res = await fetch(`/api/outreach/signatures/${editingSignature.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            signature_html: html,
            signature_json: design,
          }),
        });
        if (res.ok) {
          const updated = await res.json();
          setSignatures((prev) => prev.map((s) => s.id === updated.id ? updated : s));
          setEditingSignature(updated);
          toast.success("Signature saved");
        } else {
          const err = await res.json();
          toast.error(err.error || "Failed to save signature");
        }
      } catch {
        toast.error("Failed to save signature");
      } finally {
        setSigSaving(false);
      }
    });
  };

  const handleDeleteSignature = async (id: string) => {
    const sig = signatures.find((s) => s.id === id);
    if (!confirm(`Delete signature "${sig?.name}"? This cannot be undone.`)) return;
    setSigDeleting(id);
    try {
      const res = await fetch(`/api/outreach/signatures/${id}`, { method: "DELETE" });
      if (res.ok) {
        setSignatures((prev) => prev.filter((s) => s.id !== id));
        if (editingSignature?.id === id) setEditingSignature(null);
        toast.success("Signature deleted");
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to delete signature");
      }
    } catch {
      toast.error("Failed to delete signature");
    } finally {
      setSigDeleting(null);
    }
  };

  const handleSetDefault = async (sigId: string, type: "default" | "automation") => {
    try {
      const update: Record<string, unknown> = {};
      if (type === "default") {
        update.default_signature_id = sigId;
        setDefaultSigId(sigId);
      } else {
        update.automation_signature_id = sigId;
        setAutomationSigId(sigId);
      }

      const res = await fetch("/api/outreach/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });
      if (res.ok) {
        toast.success(`${type === "default" ? "Campaign" : "Automation"} default updated`);
      } else {
        toast.error("Failed to update default");
      }
    } catch {
      toast.error("Failed to update default");
    }
  };

  const handleEditSignature = (sig: Signature) => {
    // If currently editing another, just switch
    setEditingSignature(sig);
  };

  const handleCloneSignature = async (sig: Signature) => {
    setSigSaving(true);
    try {
      const res = await fetch("/api/outreach/signatures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${sig.name} (Copy)`,
          signature_html: sig.signature_html || "",
          signature_json: sig.signature_json || BLANK_SIGNATURE_DESIGN,
        }),
      });
      if (res.ok) {
        const cloned = await res.json();
        setSignatures((prev) => [...prev, cloned]);
        setEditingSignature(cloned);
        toast.success(`Cloned as "${cloned.name}"`);
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to clone signature");
      }
    } catch {
      toast.error("Failed to clone signature");
    } finally {
      setSigSaving(false);
    }
  };

  const handlePreview = () => {
    emailEditorRef.current?.editor?.exportHtml((data) => {
      setPreviewHtml(data.html);
      setShowPreview(true);
    });
  };

  const handleResetSignature = () => {
    if (confirm("Reset signature to blank template? This will discard unsaved changes.")) {
      emailEditorRef.current?.editor?.loadDesign(BLANK_SIGNATURE_DESIGN);
      toast.info("Signature reset to blank template");
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-slate-500">Failed to load settings</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      {/* Header */}
      <div className="bg-white border-b px-8 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/outreach">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">
                Outreach Settings
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Configure default settings for email campaigns
              </p>
            </div>
          </div>
          {activeTab === "general" && (
            <Button onClick={handleSaveSettings} disabled={saving} className="gap-2">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Settings
            </Button>
          )}
        </div>
      </div>

      {/* Settings Content */}
      <div className="px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="general" className="gap-2">
              <Mail className="h-4 w-4" />
              General
            </TabsTrigger>
            <TabsTrigger value="signature" className="gap-2">
              <FileSignature className="h-4 w-4" />
              Signatures
            </TabsTrigger>
          </TabsList>

          {/* General Settings Tab */}
          <TabsContent value="general" className="space-y-6 max-w-3xl">
            {/* Sender Settings */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-slate-500" />
                  <CardTitle className="text-lg">Sender Settings</CardTitle>
                </div>
                <CardDescription>
                  Default sender information for new campaigns
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="from_name">From Name</Label>
                    <Input
                      id="from_name"
                      value={settings.default_from_name}
                      onChange={(e) =>
                        updateSetting("default_from_name", e.target.value)
                      }
                      placeholder="Chris Born"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="from_email">From Email</Label>
                    <Input
                      id="from_email"
                      type="email"
                      value={settings.default_from_email}
                      onChange={(e) =>
                        updateSetting("default_from_email", e.target.value)
                      }
                      placeholder="c.born@mact.au"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reply_to">Default Reply-To Address</Label>
                  <Input
                    id="reply_to"
                    type="email"
                    value={settings.default_reply_to}
                    onChange={(e) =>
                      updateSetting("default_reply_to", e.target.value)
                    }
                    placeholder="c.born@reply.mact.au"
                  />
                  <p className="text-xs text-slate-500">
                    Replies to campaign emails will be sent to this address for tracking
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Reply Handling */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Forward className="h-5 w-5 text-slate-500" />
                  <CardTitle className="text-lg">Reply Handling</CardTitle>
                </div>
                <CardDescription>
                  Configure how customer replies are handled
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Forward Replies</Label>
                    <p className="text-sm text-slate-500">
                      Automatically forward customer replies to your inbox
                    </p>
                  </div>
                  <Switch
                    checked={settings.forward_replies}
                    onCheckedChange={(checked) =>
                      updateSetting("forward_replies", checked)
                    }
                  />
                </div>
                {settings.forward_replies && (
                  <div className="space-y-2">
                    <Label htmlFor="forward_to">Forward To</Label>
                    <Input
                      id="forward_to"
                      type="email"
                      value={settings.forward_replies_to}
                      onChange={(e) =>
                        updateSetting("forward_replies_to", e.target.value)
                      }
                      placeholder="c.born@mact.au"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sending Settings */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-slate-500" />
                  <CardTitle className="text-lg">Sending Settings</CardTitle>
                </div>
                <CardDescription>
                  Control email sending rate and timing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="emails_per_hour">Emails Per Hour</Label>
                  <Input
                    id="emails_per_hour"
                    type="number"
                    min="1"
                    max="500"
                    value={settings.max_emails_per_hour}
                    onChange={(e) =>
                      updateSetting(
                        "max_emails_per_hour",
                        parseInt(e.target.value) || 50
                      )
                    }
                  />
                  <p className="text-xs text-slate-500">
                    Maximum emails to send per hour (recommended: 50-100)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select
                    value={settings.timezone}
                    onValueChange={(value) => updateSetting("timezone", value)}
                  >
                    <SelectTrigger id="timezone">
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONE_OPTIONS.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="window_start">Send Window Start</Label>
                    <Input
                      id="window_start"
                      type="time"
                      value={settings.send_window_start}
                      onChange={(e) =>
                        updateSetting("send_window_start", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="window_end">Send Window End</Label>
                    <Input
                      id="window_end"
                      type="time"
                      value={settings.send_window_end}
                      onChange={(e) =>
                        updateSetting("send_window_end", e.target.value)
                      }
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Emails will only be sent during this time window ({getTimezoneLabel(settings.timezone)} time)
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Signatures Tab */}
          <TabsContent value="signature" className="space-y-6">
            {/* Signature Library */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Signature Library</CardTitle>
                    <CardDescription>
                      Create and manage email signatures. Assign them to campaigns or automations.
                    </CardDescription>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setShowNewSigForm(true)}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    New Signature
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* New signature form */}
                {showNewSigForm && (
                  <div className="flex items-center gap-2 p-3 border rounded-lg bg-slate-50">
                    <Input
                      placeholder="Signature name (e.g. Chris Born, Sales Team)"
                      value={newSigName}
                      onChange={(e) => setNewSigName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleCreateSignature()}
                      className="flex-1"
                      autoFocus
                    />
                    <Button size="sm" onClick={handleCreateSignature} disabled={sigSaving}>
                      {sigSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setShowNewSigForm(false); setNewSigName(""); }}>
                      Cancel
                    </Button>
                  </div>
                )}

                {/* Signature list */}
                {signatures.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <FileSignature className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No signatures yet. Create one to get started.</p>
                  </div>
                ) : (
                  <div className="divide-y rounded-lg border">
                    {signatures.map((sig) => (
                      <div
                        key={sig.id}
                        className={`flex items-center justify-between p-3 ${
                          editingSignature?.id === sig.id ? "bg-blue-50" : "hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{sig.name}</span>
                              {defaultSigId === sig.id && (
                                <Badge variant="outline" className="text-xs border-blue-200 bg-blue-50 text-blue-700">
                                  Campaign Default
                                </Badge>
                              )}
                              {automationSigId === sig.id && (
                                <Badge variant="outline" className="text-xs border-purple-200 bg-purple-50 text-purple-700">
                                  Automation Default
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs text-slate-400">
                              Updated {new Date(sig.updated_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant={editingSignature?.id === sig.id ? "default" : "outline"}
                            onClick={() => handleEditSignature(sig)}
                            className="gap-1"
                          >
                            <Pencil className="h-3 w-3" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCloneSignature(sig)}
                            disabled={sigSaving}
                            className="gap-1"
                            title="Clone signature"
                          >
                            <Copy className="h-3 w-3" />
                            Clone
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteSignature(sig.id)}
                            disabled={sigDeleting === sig.id}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            {sigDeleting === sig.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Default assignments */}
                {signatures.length > 0 && (
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Campaign Default
                      </Label>
                      <Select
                        value={defaultSigId || ""}
                        onValueChange={(v) => handleSetDefault(v, "default")}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select default signature" />
                        </SelectTrigger>
                        <SelectContent>
                          {signatures.map((sig) => (
                            <SelectItem key={sig.id} value={sig.id}>{sig.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-slate-400">Used for outreach campaigns</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Automation Default
                      </Label>
                      <Select
                        value={automationSigId || ""}
                        onValueChange={(v) => handleSetDefault(v, "automation")}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select automation signature" />
                        </SelectTrigger>
                        <SelectContent>
                          {signatures.map((sig) => (
                            <SelectItem key={sig.id} value={sig.id}>{sig.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-slate-400">Used for order follow-up emails</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Signature Editor */}
            {editingSignature && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        Editing: {editingSignature.name}
                      </CardTitle>
                      <CardDescription>
                        Design your signature using the visual editor below
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={handleResetSignature} className="gap-1">
                        <RotateCcw className="h-3 w-3" />
                        Reset
                      </Button>
                      <Button variant="outline" size="sm" onClick={handlePreview} className="gap-1">
                        <Eye className="h-3 w-3" />
                        Preview
                      </Button>
                      <Button size="sm" onClick={handleSaveSignature} disabled={sigSaving} className="gap-1">
                        {sigSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                        Save Signature
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="border rounded-lg overflow-hidden">
                    <EmailEditor
                      ref={emailEditorRef}
                      onReady={onEditorReady}
                      minHeight="550px"
                      options={{
                        displayMode: "email",
                        features: {
                          textEditor: {
                            spellChecker: true,
                          },
                        },
                        appearance: {
                          theme: "light",
                          panels: {
                            tools: {
                              dock: "left",
                            },
                          },
                        },
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {!editingSignature && signatures.length > 0 && (
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="font-medium text-blue-900 mb-2">Tips:</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>Click <strong>Edit</strong> on a signature to open the visual editor</li>
                  <li>Set <strong>Campaign Default</strong> for outreach campaigns</li>
                  <li>Set <strong>Automation Default</strong> for order follow-up emails</li>
                  <li>You can override the signature per-campaign when creating a new campaign</li>
                </ul>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-semibold">Signature Preview</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowPreview(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4 overflow-auto max-h-[70vh]">
              <div className="border rounded-lg p-4 bg-slate-50">
                <div className="text-sm text-slate-500 mb-4">
                  <p><strong>From:</strong> {settings.default_from_name} &lt;{settings.default_from_email}&gt;</p>
                  <p><strong>Subject:</strong> Quick question about your project</p>
                </div>
                <div className="bg-white p-4 rounded border">
                  <p className="mb-4">Hi Drew,</p>
                  <p className="mb-4">
                    Just checking in on your recent order. Let me know if you need anything!
                  </p>
                  <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
