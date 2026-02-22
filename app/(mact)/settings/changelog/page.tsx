"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Bug,
  Sparkles,
  Wrench,
  AlertCircle,
  CheckCircle2,
  MessageCircle,
  Layout,
  Plus,
  Trash2,
  Database,
  FileText,
} from "lucide-react";
import { ADMIN_VERSION, WIDGET_VERSION } from "@/lib/version";

interface ChangelogEntry {
  id?: string;
  version: string;
  date: string;
  type: "fix" | "feature" | "improvement" | "breaking";
  category?: "admin" | "widget";
  title: string;
  description: string;
  details?: string[];
  source?: "db" | "hardcoded";
}

// Historical hardcoded entries (kept for reference - new entries go to DB)
const historicalWidgetEntries: ChangelogEntry[] = [
  {
    version: "1.4.0",
    date: "2025-01-19",
    type: "feature",
    title: "Chat Ratings & Feedback (TASK #031)",
    description:
      "Visitors can now rate their chat experience after 5 minutes of inactivity.",
    details: [
      "5-star rating prompt appears after 5 min inactivity",
      "Optional feedback textarea for additional comments",
      "Rating saved to database and visible in inbox",
    ],
  },
  {
    version: "1.3.0",
    date: "2025-01-18",
    type: "feature",
    title: "Pre-chat Form (TASK #030)",
    description:
      "Configurable pre-chat form to collect visitor information before starting a conversation.",
    details: [
      "Customizable fields (name, email, phone, dropdown, text)",
      "Required/optional field configuration",
      "Data attached to conversation for agent context",
    ],
  },
  {
    version: "1.2.0",
    date: "2025-01-12",
    type: "fix",
    title: "Fixed Chunky Chat Bubbles",
    description:
      "Resolved the issue where chat message bubbles appeared too chunky compared to professional chat widgets.",
    details: [
      "Reduced gap between messages from 12px to 6px",
      "Added display: inline-block to prevent bubble stretching",
    ],
  },
  {
    version: "1.0.0",
    date: "2025-01-12",
    type: "feature",
    title: "V2 Widget - Complete Rebuild",
    description:
      "Complete rebuild using Web Components (Custom Elements + Shadow DOM) for true CSS isolation.",
    details: [
      "True CSS isolation - host site styles cannot affect widget",
      "Asymmetric border-radius on bubbles (Messenger-style)",
      "Handoff form for human agent requests",
    ],
  },
];

const historicalAdminEntries: ChangelogEntry[] = [
  {
    version: "2.20.1",
    date: "2025-01-27",
    type: "fix",
    title: "Multiple Outreach Bug Fixes",
    description:
      "Fixed campaign progress stuck at 0/1, Reply-To not using settings, and polling intervals not working.",
    details: [
      "Fix: increment_campaign_sent RPC fallback to direct update",
      "Fix: Reply-To now loads from outreach_settings on new campaign page",
      "Fix: Polling intervals reset bug",
    ],
  },
  {
    version: "2.20.0",
    date: "2025-01-27",
    type: "feature",
    title: "Outreach Settings Page + Campaign List UI Refresh (TASK #059)",
    description:
      "Full settings page for Outreach module with sender config, reply handling, and sending rate limits.",
    details: [
      "New /outreach/settings page with tabbed UI",
      "Sender Settings: From Name, From Email, Default Reply-To",
      "Campaign list redesigned with wider layout and filter row",
    ],
  },
  {
    version: "2.19.0",
    date: "2025-01-25",
    type: "improvement",
    title: "Cin7 Sync Stores Product Line Items (TASK #058)",
    description:
      "Cin7 sync now fetches and stores full line item details for each order.",
    details: [
      "Enhanced syncCin7Orders() to fetch individual sale details",
      "Line items stored locally in cin7_orders.line_items",
      "Email preview renders instantly from local data",
    ],
  },
  {
    version: "2.18.0",
    date: "2025-01-25",
    type: "feature",
    title: "Full Email Preview with Recipient Navigation (TASK #057)",
    description:
      "Campaign preview step now shows EXACTLY what each recipient will see.",
    details: [
      "Preview shows full HTML email in iframe",
      "Previous/Next buttons to navigate through ALL recipients",
      "Collapsible personalization data viewer for debugging",
    ],
  },
  {
    version: "2.17.0",
    date: "2025-01-24",
    type: "fix",
    title: "Fix Campaign Preview Template Variables",
    description:
      "Fixed woo_orders column names in segments.ts and added {{coupon_code}} support.",
    details: [
      "Fixed woo_orders queries: order_date, customer_email",
      "Added {{coupon_code}} variable with THANKYOU10 fallback",
    ],
  },
  {
    version: "2.14.0",
    date: "2025-01-24",
    type: "feature",
    title: "Add Outreach to Main Sidebar Navigation",
    description:
      "Outreach module now accessible from the main sidebar navigation.",
  },
  {
    version: "2.13.0",
    date: "2025-01-24",
    type: "feature",
    title: "Unlayer Drag-and-Drop Email Signature Editor (TASK #056)",
    description:
      "Visual drag-and-drop editor for designing email signatures.",
    details: [
      "Unlayer react-email-editor integration",
      "Design JSON saved for re-editing",
      "Default signature pre-loaded",
    ],
  },
  {
    version: "2.10.0",
    date: "2025-01-23",
    type: "feature",
    title: "Inbox Polish & Team System (TASK #043-046)",
    description:
      "Auto-resolve inactive chats, route protection middleware, and chat assignment system.",
    details: [
      "Auto-resolve chats after 24h inactivity",
      "Middleware protects admin routes",
      "Assign dropdown with team member list",
      "'My Chats' and 'Unassigned' filters",
    ],
  },
  {
    version: "2.7.0",
    date: "2025-01-22",
    type: "feature",
    title: "Customers Page Enhancements (TASK #038)",
    description:
      "Enhanced customers page with order aggregates, segment filtering, sortable columns.",
    details: [
      "Summary stats cards (Total, VIP, Active, Dormant)",
      "Segment tabs for quick filtering",
      "Customer tier badges based on order count and spend",
    ],
  },
  {
    version: "2.0.0",
    date: "2025-01-18",
    type: "feature",
    title: "Multi-LLM Provider Support (TASK #022)",
    description:
      "Support for multiple AI providers including OpenAI, Anthropic, and DeepSeek.",
    details: [
      "Provider selection in Settings > AI Provider",
      "Model selection per provider",
      "Token usage tracking and cost dashboard",
    ],
  },
];

const typeConfig = {
  fix: {
    icon: Bug,
    color: "bg-red-100 text-red-700",
    label: "Bug Fix",
  },
  feature: {
    icon: Sparkles,
    color: "bg-green-100 text-green-700",
    label: "New Feature",
  },
  improvement: {
    icon: Wrench,
    color: "bg-blue-100 text-blue-700",
    label: "Improvement",
  },
  breaking: {
    icon: AlertCircle,
    color: "bg-orange-100 text-orange-700",
    label: "Breaking Change",
  },
};

function ChangelogEntryCard({
  entry,
  onDelete,
}: {
  entry: ChangelogEntry;
  onDelete?: (id: string) => void;
}) {
  const TypeIcon = typeConfig[entry.type].icon;
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Badge
              variant="outline"
              className="font-mono text-base font-semibold"
            >
              v{entry.version}
            </Badge>
            <Badge className={typeConfig[entry.type].color}>
              <TypeIcon className="mr-1 h-3 w-3" />
              {typeConfig[entry.type].label}
            </Badge>
            {entry.source === "db" && (
              <Badge variant="outline" className="text-xs border-blue-200 bg-blue-50 text-blue-600">
                <Database className="mr-1 h-3 w-3" />
                DB
              </Badge>
            )}
            {entry.source === "hardcoded" && (
              <Badge variant="outline" className="text-xs border-slate-200 text-slate-400">
                <FileText className="mr-1 h-3 w-3" />
                Legacy
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">{entry.date}</span>
            {entry.source === "db" && entry.id && onDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-slate-400 hover:text-red-500"
                onClick={() => onDelete(entry.id!)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        <h3 className="mt-3 text-lg font-semibold text-slate-900">
          {entry.title}
        </h3>
        <p className="mt-1 text-slate-600">{entry.description}</p>

        {entry.details && entry.details.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium text-slate-700">Changes:</h4>
            <ul className="mt-2 space-y-1">
              {entry.details.map((detail, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-slate-600"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
                  {detail}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ChangelogPage() {
  const [dbEntries, setDbEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formVersion, setFormVersion] = useState("");
  const [formDate, setFormDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [formType, setFormType] = useState<string>("feature");
  const [formCategory, setFormCategory] = useState<string>("admin");
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formDetails, setFormDetails] = useState("");

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch("/api/changelog");
      if (res.ok) {
        const data = await res.json();
        setDbEntries(
          (data.entries || []).map((e: ChangelogEntry) => ({
            ...e,
            source: "db" as const,
          }))
        );
      }
    } catch {
      // DB might not be set up yet, that's OK
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleSubmit = async () => {
    if (!formVersion || !formTitle || !formDescription) return;

    setSaving(true);
    try {
      const details = formDetails
        .split("\n")
        .map((d) => d.trim())
        .filter(Boolean);

      const res = await fetch("/api/changelog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: formVersion,
          date: formDate,
          type: formType,
          category: formCategory,
          title: formTitle,
          description: formDescription,
          details,
        }),
      });

      if (res.ok) {
        setDialogOpen(false);
        resetForm();
        fetchEntries();
      }
    } catch (error) {
      console.error("Failed to create entry:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this changelog entry?")) return;
    try {
      const res = await fetch(`/api/changelog/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchEntries();
      }
    } catch (error) {
      console.error("Failed to delete entry:", error);
    }
  };

  const resetForm = () => {
    setFormVersion("");
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormType("feature");
    setFormCategory("admin");
    setFormTitle("");
    setFormDescription("");
    setFormDetails("");
  };

  // Merge DB entries with historical ones
  const getWidgetEntries = () => {
    const db = dbEntries.filter((e) => e.category === "widget");
    const historical = historicalWidgetEntries.map((e) => ({
      ...e,
      source: "hardcoded" as const,
    }));
    return [...db, ...historical];
  };

  const getAdminEntries = () => {
    const db = dbEntries.filter(
      (e) => e.category === "admin" || !e.category
    );
    const historical = historicalAdminEntries.map((e) => ({
      ...e,
      source: "hardcoded" as const,
    }));
    return [...db, ...historical];
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
            <h1 className="text-xl font-semibold text-slate-900">Changelog</h1>
            <p className="text-sm text-slate-500">
              Version history and updates for MACt
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New Entry
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add Changelog Entry</DialogTitle>
                <DialogDescription>
                  Record a new version update or change.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Version
                    </label>
                    <Input
                      placeholder="e.g. 2.21.0"
                      value={formVersion}
                      onChange={(e) => setFormVersion(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Date
                    </label>
                    <Input
                      type="date"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Type
                    </label>
                    <Select value={formType} onValueChange={setFormType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="feature">New Feature</SelectItem>
                        <SelectItem value="fix">Bug Fix</SelectItem>
                        <SelectItem value="improvement">Improvement</SelectItem>
                        <SelectItem value="breaking">Breaking Change</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Category
                    </label>
                    <Select value={formCategory} onValueChange={setFormCategory}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin Panel</SelectItem>
                        <SelectItem value="widget">Widget</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Title
                  </label>
                  <Input
                    placeholder="e.g. Chat Follow-up System (TASK #090)"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Description
                  </label>
                  <Textarea
                    placeholder="Brief description of what changed..."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    rows={2}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Details (one per line)
                  </label>
                  <Textarea
                    placeholder={"Added X feature\nFixed Y bug\nImproved Z performance"}
                    value={formDetails}
                    onChange={(e) => setFormDetails(e.target.value)}
                    rows={4}
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={saving || !formVersion || !formTitle || !formDescription}
                  >
                    {saving ? "Saving..." : "Add Entry"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="p-6">
        <div className="max-w-4xl space-y-6">
          {/* Current Versions Card */}
          <Card className="border-0 bg-gradient-to-r from-blue-600 to-indigo-600 shadow-sm">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-white">
                Current Versions
              </h3>
              <div className="mt-4 flex gap-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                    <MessageCircle className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-white/70">Widget</p>
                    <p className="text-xl font-bold text-white">
                      v{WIDGET_VERSION}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                    <Layout className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-white/70">Admin Panel</p>
                    <p className="text-xl font-bold text-white">
                      v{ADMIN_VERSION}
                    </p>
                  </div>
                </div>
              </div>
              {!loading && dbEntries.length > 0 && (
                <div className="mt-4 flex items-center gap-2 text-sm text-white/60">
                  <Database className="h-4 w-4" />
                  {dbEntries.length} entries in database
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tabs for Widget vs Admin changelog */}
          <Tabs defaultValue="admin" className="w-full">
            <TabsList className="mb-6 grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="admin" className="gap-2">
                <Layout className="h-4 w-4" />
                Admin Panel
              </TabsTrigger>
              <TabsTrigger value="widget" className="gap-2">
                <MessageCircle className="h-4 w-4" />
                Widget
              </TabsTrigger>
            </TabsList>

            <TabsContent value="admin" className="space-y-6">
              {loading ? (
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-6 text-center text-slate-500">
                    Loading changelog...
                  </CardContent>
                </Card>
              ) : (
                getAdminEntries().map((entry, i) => (
                  <ChangelogEntryCard
                    key={entry.id || `admin-${i}`}
                    entry={entry}
                    onDelete={entry.source === "db" ? handleDelete : undefined}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="widget" className="space-y-6">
              {loading ? (
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-6 text-center text-slate-500">
                    Loading changelog...
                  </CardContent>
                </Card>
              ) : (
                getWidgetEntries().map((entry, i) => (
                  <ChangelogEntryCard
                    key={entry.id || `widget-${i}`}
                    entry={entry}
                    onDelete={entry.source === "db" ? handleDelete : undefined}
                  />
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
