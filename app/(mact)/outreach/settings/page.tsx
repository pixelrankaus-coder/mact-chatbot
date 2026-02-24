"use client";

import { useRef, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  Zap,
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

// Default signature design matching Chris's Outlook signature
const DEFAULT_SIGNATURE_DESIGN = {
  counters: { u_row: 4, u_column: 4, u_content_text: 4, u_content_image: 1 },
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
                  text: '<p style="font-size: 14px; line-height: 140%; font-family: arial, helvetica, sans-serif;">Cheers,<br />Chris</p>',
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
                  text: `<p style="font-size: 13px; line-height: 160%; color: #ffffff; font-family: arial, helvetica, sans-serif;"><strong style="font-size: 15px;">Chris Born</strong><br /><span style="color: #999999;">Technical Director / Founder</span><br /><br />Mobile 0405 606 234<br />Office 0466 334 630<br /><a rel="noopener" href="mailto:c.born@mact.au" target="_blank" style="color: #00b4b4;">c.born@mact.au</a><br />Unit 3C, 919-925 Nudgee Road,<br />Banyo, QLD 4014</p>`,
                },
              },
            ],
            values: { backgroundColor: "#1a1a1a", padding: "10px", borderRadius: "0 8px 8px 0" },
          },
        ],
        values: { padding: "10px 0" },
      },
      {
        id: "row3",
        cells: [1],
        columns: [
          {
            id: "col4",
            contents: [
              {
                id: "text3",
                type: "text",
                values: {
                  containerPadding: "15px 0",
                  textAlign: "left",
                  lineHeight: "140%",
                  text: `<p style="font-size: 14px; line-height: 140%; font-family: arial, helvetica, sans-serif;"><a rel="noopener" href="https://mact.au" target="_blank" style="color: #00b4b4; font-weight: bold; text-decoration: none;">mact.au</a>&nbsp;&nbsp;<span style="background: #00b4b4; color: white; padding: 4px 10px; border-radius: 3px; font-size: 12px;">GFRC</span>&nbsp;<span style="background: #00b4b4; color: white; padding: 4px 10px; border-radius: 3px; font-size: 12px;">Mining</span>&nbsp;<span style="background: #00b4b4; color: white; padding: 4px 10px; border-radius: 3px; font-size: 12px;">Admixtures</span></p>`,
                },
              },
            ],
            values: { padding: "0px" },
          },
        ],
        values: { padding: "0px" },
      },
      {
        id: "row4",
        cells: [1],
        columns: [
          {
            id: "col5",
            contents: [
              {
                id: "text4",
                type: "text",
                values: {
                  containerPadding: "20px 0 0 0",
                  textAlign: "left",
                  lineHeight: "150%",
                  text: `<p style="font-size: 10px; line-height: 150%; color: #999999; font-family: arial, helvetica, sans-serif;">Copyright 2023 by Mining and Cement Technology Pty Ltd. All rights reserved. This email may contain privileged/confidential information.</p>`,
                },
              },
            ],
            values: { padding: "0px" },
          },
        ],
        values: { padding: "0px" },
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

// Default automation signature design for Lauren Born
const DEFAULT_AUTOMATION_SIGNATURE_DESIGN = {
  counters: { u_row: 4, u_column: 4, u_content_text: 4, u_content_image: 1 },
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
                  text: '<p style="font-size: 14px; line-height: 140%; font-family: arial, helvetica, sans-serif;">Thanks,<br />Lauren</p>',
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
                  text: `<p style="font-size: 13px; line-height: 160%; color: #ffffff; font-family: arial, helvetica, sans-serif;"><strong style="font-size: 15px;">Lauren Born</strong><br /><span style="color: #999999;">Administration</span><br /><br />Office 07 3111 4047<br /><a rel="noopener" href="mailto:admin@mact.au" target="_blank" style="color: #00b4b4;">admin@mact.au</a><br />Unit 3C, 919-925 Nudgee Road,<br />Banyo, QLD 4014</p>`,
                },
              },
            ],
            values: { backgroundColor: "#1a1a1a", padding: "10px", borderRadius: "0 8px 8px 0" },
          },
        ],
        values: { padding: "10px 0" },
      },
      {
        id: "row3",
        cells: [1],
        columns: [
          {
            id: "col4",
            contents: [
              {
                id: "text3",
                type: "text",
                values: {
                  containerPadding: "15px 0",
                  textAlign: "left",
                  lineHeight: "140%",
                  text: `<p style="font-size: 14px; line-height: 140%; font-family: arial, helvetica, sans-serif;"><a rel="noopener" href="https://mact.au" target="_blank" style="color: #00b4b4; font-weight: bold; text-decoration: none;">mact.au</a>&nbsp;&nbsp;<span style="background: #00b4b4; color: white; padding: 4px 10px; border-radius: 3px; font-size: 12px;">GFRC</span>&nbsp;<span style="background: #00b4b4; color: white; padding: 4px 10px; border-radius: 3px; font-size: 12px;">Mining</span>&nbsp;<span style="background: #00b4b4; color: white; padding: 4px 10px; border-radius: 3px; font-size: 12px;">Admixtures</span>&nbsp;<span style="background: #00b4b4; color: white; padding: 4px 10px; border-radius: 3px; font-size: 12px;">Concrete Chemicals</span>&nbsp;<span style="background: #00b4b4; color: white; padding: 4px 10px; border-radius: 3px; font-size: 12px;">Consulting</span></p>`,
                },
              },
            ],
            values: { padding: "0px" },
          },
        ],
        values: { padding: "0px" },
      },
      {
        id: "row4",
        cells: [1],
        columns: [
          {
            id: "col5",
            contents: [
              {
                id: "text4",
                type: "text",
                values: {
                  containerPadding: "20px 0 0 0",
                  textAlign: "left",
                  lineHeight: "150%",
                  text: `<p style="font-size: 10px; line-height: 150%; color: #999999; font-family: arial, helvetica, sans-serif;">Copyright 2023 by Mining and Cement Technology Pty Ltd. All rights reserved. This email may contain privileged/confidential information intended for the addressee. Attached materials remain the exclusive property of Mining and Cement Technology Pty Ltd, potentially constituting legally protected intellectual property. If you're not the intended recipient or responsible for delivery, don't copy or distribute this email. If received in error, notify us by phone. Mining and Cement Technology Pty Ltd isn't liable for unauthorized use. Company email traffic may be monitored. Thank you.</p>`,
                },
              },
            ],
            values: { padding: "0px" },
          },
        ],
        values: { padding: "0px" },
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

type SignatureType = "default" | "automation";

export default function OutreachSettingsPage() {
  const emailEditorRef = useRef<EditorRef>(null);
  const [settings, setSettings] = useState<OutreachSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  const [activeSigType, setActiveSigType] = useState<SignatureType>("default");
  // Cache for the design that's NOT currently in the editor
  const cachedDesignRef = useRef<{ type: SignatureType; design: Record<string, unknown> | null }>({ type: "automation", design: null });

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (editorReady && settings && emailEditorRef.current?.editor) {
      if (activeSigType === "default") {
        const design = settings.signature_json || DEFAULT_SIGNATURE_DESIGN;
        emailEditorRef.current.editor.loadDesign(design);
        // Cache the automation design
        cachedDesignRef.current = { type: "automation", design: settings.automation_signature_json || DEFAULT_AUTOMATION_SIGNATURE_DESIGN };
      } else {
        const design = settings.automation_signature_json || DEFAULT_AUTOMATION_SIGNATURE_DESIGN;
        emailEditorRef.current.editor.loadDesign(design);
        // Cache the default design
        cachedDesignRef.current = { type: "default", design: settings.signature_json || DEFAULT_SIGNATURE_DESIGN };
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorReady, settings]);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/outreach/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings({ ...defaultSettings, ...data });
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
  };

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);

    // If signature editor is available, export the active design
    if (emailEditorRef.current?.editor) {
      await new Promise<void>((resolve) => {
        emailEditorRef.current!.editor!.exportHtml(async (data) => {
          const { design, html } = data;
          const updatedSettings = { ...settings };

          if (activeSigType === "default") {
            updatedSettings.signature_json = design;
            updatedSettings.signature_html = html;
          } else {
            updatedSettings.automation_signature_json = design;
            updatedSettings.automation_signature_html = html;
          }

          await saveSettings(updatedSettings);
          resolve();
        });
      });
    } else {
      await saveSettings(settings);
    }
  };

  const saveSettings = async (settingsToSave: OutreachSettings) => {
    try {
      const res = await fetch("/api/outreach/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settingsToSave),
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

  const handleSwitchSignature = (newType: SignatureType) => {
    if (newType === activeSigType || !emailEditorRef.current?.editor) return;

    // Export current editor design and cache it
    emailEditorRef.current.editor.exportHtml((data) => {
      const { design, html } = data;

      // Save current design to settings state
      if (activeSigType === "default") {
        setSettings((prev) => prev ? { ...prev, signature_json: design, signature_html: html } : prev);
      } else {
        setSettings((prev) => prev ? { ...prev, automation_signature_json: design, automation_signature_html: html } : prev);
      }

      // Cache the current design
      cachedDesignRef.current = { type: activeSigType, design };

      // Load the other design
      const otherDesign = newType === "default"
        ? (settings?.signature_json || DEFAULT_SIGNATURE_DESIGN)
        : (settings?.automation_signature_json || DEFAULT_AUTOMATION_SIGNATURE_DESIGN);

      emailEditorRef.current?.editor?.loadDesign(
        cachedDesignRef.current.type === newType && cachedDesignRef.current.design
          ? cachedDesignRef.current.design
          : otherDesign
      );

      setActiveSigType(newType);
    });
  };

  const handleResetSignature = () => {
    const label = activeSigType === "default" ? "default" : "automation";
    if (confirm(`Reset ${label} signature to default? This will discard your changes.`)) {
      const design = activeSigType === "default" ? DEFAULT_SIGNATURE_DESIGN : DEFAULT_AUTOMATION_SIGNATURE_DESIGN;
      emailEditorRef.current?.editor?.loadDesign(design);
      toast.info(`${activeSigType === "default" ? "Default" : "Automation"} signature reset`);
    }
  };

  const handlePreview = () => {
    emailEditorRef.current?.editor?.exportHtml((data) => {
      setPreviewHtml(data.html);
      setShowPreview(true);
    });
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
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Settings
          </Button>
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
              Signature
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

          {/* Signature Tab */}
          <TabsContent value="signature" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Email Signature</h2>
                <p className="text-sm text-slate-500">
                  {activeSigType === "default"
                    ? "Default signature for outreach campaigns (Chris)"
                    : "Automation signature for order follow-ups (Lauren)"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handleResetSignature} className="gap-2">
                  <RotateCcw className="h-4 w-4" />
                  Reset to Default
                </Button>
                <Button variant="outline" onClick={handlePreview} className="gap-2">
                  <Eye className="h-4 w-4" />
                  Preview
                </Button>
              </div>
            </div>

            {/* Signature Type Switcher */}
            <div className="flex gap-2">
              <Button
                variant={activeSigType === "default" ? "default" : "outline"}
                size="sm"
                onClick={() => handleSwitchSignature("default")}
                className="gap-2"
              >
                <Mail className="h-4 w-4" />
                Default (Chris)
              </Button>
              <Button
                variant={activeSigType === "automation" ? "default" : "outline"}
                size="sm"
                onClick={() => handleSwitchSignature("automation")}
                className="gap-2"
              >
                <Zap className="h-4 w-4" />
                Automation (Lauren)
              </Button>
            </div>

            <Card>
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

            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="font-medium text-blue-900 mb-2">Tips:</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Drag blocks from the left panel to build your signature</li>
                <li>• Click any element to edit its content and styling</li>
                <li>• Use the Image block to add your logo</li>
                <li>• Click Preview to see how it will look in emails</li>
              </ul>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-semibold">Email Preview</h2>
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
                    It&apos;s been a while since you grabbed that product. I&apos;d love
                    to know how that project turned out!
                  </p>
                  <p className="mb-4">
                    Still working with GFRC? Happy to help if you need anything.
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
