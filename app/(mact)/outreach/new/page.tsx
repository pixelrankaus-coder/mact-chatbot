"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft,
  ArrowRight,
  Users,
  FileText,
  Eye,
  Send,
  Loader2,
  Check,
  Clock,
  Mail,
  UserPlus,
  FlaskConical,
  RefreshCcw,
} from "lucide-react";
import { toast } from "sonner";
import type { OutreachTemplate } from "@/types/outreach";

interface Segment {
  id: string;
  name: string;
  description: string;
  count?: number;
}

interface PreviewRecipient {
  email: string;
  name: string;
  company?: string;
  personalization: Record<string, unknown>;
  preview: { subject: string; body: string };
  html_preview: string;
}

const STEPS = [
  { id: 1, name: "Segment", icon: Users },
  { id: 2, name: "Template", icon: FileText },
  { id: 3, name: "Preview", icon: Eye },
  { id: 4, name: "Launch", icon: Send },
];

const SEND_RATES = [
  { value: 25, label: "25/hour", description: "Conservative" },
  { value: 50, label: "50/hour", description: "Recommended" },
  { value: 100, label: "100/hour", description: "Faster" },
];

const RESEND_DELAYS = [
  { value: 0.05, label: "3 minutes (test)" },
  { value: 48, label: "48 hours" },
  { value: 72, label: "3 days" },
  { value: 120, label: "5 days" },
  { value: 168, label: "7 days" },
];

export default function NewCampaignPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  // Step 1: Segment
  const [segments, setSegments] = useState<Segment[]>([]);
  const [selectedSegment, setSelectedSegment] = useState<string>("");
  const [loadingSegments, setLoadingSegments] = useState(true);
  const [customEmails, setCustomEmails] = useState<string>("");

  // Parse custom emails and get count
  const parsedCustomEmails = customEmails
    .split("\n")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e && e.includes("@"));
  const customEmailCount = parsedCustomEmails.length;

  // Step 2: Template
  const [templates, setTemplates] = useState<OutreachTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  // Step 3: Preview
  const [campaignName, setCampaignName] = useState("");
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [sendRate, setSendRate] = useState(50);
  const [allRecipients, setAllRecipients] = useState<PreviewRecipient[]>([]);
  const [totalRecipients, setTotalRecipients] = useState(0);
  const [previewIndex, setPreviewIndex] = useState(0);

  // Step 4: Schedule
  const [sendNow, setSendNow] = useState(true);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("09:00");
  const [isDryRun, setIsDryRun] = useState(false);

  // Auto-resend to non-openers
  const [autoResendEnabled, setAutoResendEnabled] = useState(false);
  const [resendDelayHours, setResendDelayHours] = useState(72);
  const [resendSubject, setResendSubject] = useState("");

  // Fetch segments, templates, and settings on mount
  useEffect(() => {
    fetchSegments();
    fetchTemplates();
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/outreach/settings");
      const data = await res.json();
      if (data) {
        setFromName(data.default_from_name || "Chris Born");
        setFromEmail(data.default_from_email || "c.born@mact.au");
        setReplyTo(data.default_reply_to || "c.born@reply.mact.au");
        setSendRate(data.max_emails_per_hour || 50);
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
      // Use fallback defaults
      setFromName("Chris Born");
      setFromEmail("c.born@mact.au");
      setReplyTo("c.born@reply.mact.au");
    }
  };

  const fetchSegments = async () => {
    try {
      const res = await fetch("/api/outreach/segments");
      const data = await res.json();
      setSegments(data.segments || []);
    } catch (error) {
      console.error("Failed to fetch segments:", error);
      toast.error("Failed to load segments");
    } finally {
      setLoadingSegments(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch("/api/outreach/templates");
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (error) {
      console.error("Failed to fetch templates:", error);
      toast.error("Failed to load templates");
    } finally {
      setLoadingTemplates(false);
    }
  };

  const fetchPreview = async (campaignId: string) => {
    try {
      const res = await fetch(`/api/outreach/campaigns/${campaignId}/preview`);
      const data = await res.json();
      setAllRecipients(data.all_recipients || []);
      setTotalRecipients(data.total_recipients || 0);
      setPreviewIndex(0); // Reset to first recipient
    } catch (error) {
      console.error("Failed to fetch preview:", error);
    }
  };

  const getEstimatedTime = () => {
    if (totalRecipients === 0 || sendRate === 0) return "N/A";
    const hours = totalRecipients / sendRate;
    if (hours < 1) {
      return `~${Math.round(hours * 60)} minutes`;
    }
    return `~${hours.toFixed(1)} hours`;
  };

  const handleNext = async () => {
    if (step === 1 && !selectedSegment) {
      toast.error("Please select a segment");
      return;
    }

    if (step === 1 && selectedSegment === "custom" && customEmailCount === 0) {
      toast.error("Please enter at least one email address");
      return;
    }

    if (step === 2 && !selectedTemplate) {
      toast.error("Please select a template");
      return;
    }

    if (step === 2) {
      // Create draft campaign before moving to step 3
      setLoading(true);
      try {
        const segmentInfo = segments.find((s) => s.id === selectedSegment);
        const templateInfo = templates.find((t) => t.id === selectedTemplate);

        const res = await fetch("/api/outreach/campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name:
              campaignName ||
              `${segmentInfo?.name} - ${templateInfo?.name}` ||
              "New Campaign",
            template_id: selectedTemplate,
            segment: selectedSegment,
            segment_filter:
              selectedSegment === "custom"
                ? { emails: parsedCustomEmails }
                : undefined,
            from_name: fromName,
            from_email: fromEmail,
            reply_to: replyTo,
            send_rate: sendRate,
            is_dry_run: isDryRun,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to create campaign");
        }

        setCampaignName(data.campaign.name);
        setTotalRecipients(data.total_recipients);

        // Fetch preview
        await fetchPreview(data.campaign.id);
        // Store campaign id for later
        sessionStorage.setItem("draft_campaign_id", data.campaign.id);
      } catch (error) {
        console.error("Failed to create draft:", error);
        toast.error(
          error instanceof Error ? error.message : "Failed to create campaign"
        );
        setLoading(false);
        return;
      }
      setLoading(false);
    }

    if (step === 3 && !campaignName) {
      toast.error("Please enter a campaign name");
      return;
    }

    if (step < 4) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleLaunch = async (saveAsDraft = false) => {
    if (autoResendEnabled && !resendSubject.trim()) {
      toast.error("Please enter a subject line for the follow-up email");
      return;
    }

    setCreating(true);
    try {
      const campaignId = sessionStorage.getItem("draft_campaign_id");
      if (!campaignId) {
        throw new Error("Campaign not found");
      }

      // Update campaign with final settings
      let scheduledAt = null;
      if (!saveAsDraft && !sendNow && scheduledDate && scheduledTime) {
        scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
      }

      const updateRes = await fetch(`/api/outreach/campaigns/${campaignId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: campaignName,
          from_name: fromName,
          from_email: fromEmail,
          reply_to: replyTo,
          send_rate: sendRate,
          scheduled_at: scheduledAt,
          status: saveAsDraft ? "draft" : sendNow ? "scheduled" : "scheduled",
          is_dry_run: isDryRun,
          auto_resend_enabled: autoResendEnabled,
          resend_delay_hours: autoResendEnabled ? resendDelayHours : null,
          resend_subject: autoResendEnabled ? resendSubject : null,
        }),
      });

      if (!updateRes.ok) {
        const data = await updateRes.json();
        throw new Error(data.error || "Failed to update campaign");
      }

      if (!saveAsDraft && sendNow) {
        // Start sending immediately
        const sendRes = await fetch(
          `/api/outreach/campaigns/${campaignId}/send`,
          {
            method: "POST",
          }
        );

        if (!sendRes.ok) {
          const data = await sendRes.json();
          throw new Error(data.error || "Failed to start campaign");
        }

        toast.success("Campaign launched!");
      } else if (saveAsDraft) {
        toast.success("Campaign saved as draft");
      } else {
        toast.success("Campaign scheduled");
      }

      sessionStorage.removeItem("draft_campaign_id");
      router.push(`/outreach/${campaignId}`);
    } catch (error) {
      console.error("Launch error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to launch campaign"
      );
    } finally {
      setCreating(false);
    }
  };

  const selectedSegmentInfo = segments.find((s) => s.id === selectedSegment);
  const selectedTemplateInfo = templates.find(
    (t) => t.id === selectedTemplate
  );

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/outreach">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">New Campaign</h1>
          <p className="text-sm text-slate-500">
            Create a new outreach campaign
          </p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((s, index) => {
            const Icon = s.icon;
            const isActive = step === s.id;
            const isComplete = step > s.id;

            return (
              <div key={s.id} className="flex items-center">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                    isActive
                      ? "border-blue-600 bg-blue-600 text-white"
                      : isComplete
                        ? "border-green-600 bg-green-600 text-white"
                        : "border-slate-300 text-slate-400"
                  }`}
                >
                  {isComplete ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                <span
                  className={`ml-2 text-sm font-medium ${
                    isActive
                      ? "text-blue-600"
                      : isComplete
                        ? "text-green-600"
                        : "text-slate-400"
                  }`}
                >
                  {s.name}
                </span>
                {index < STEPS.length - 1 && (
                  <div
                    className={`w-12 h-0.5 mx-4 ${
                      isComplete ? "bg-green-600" : "bg-slate-200"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="pt-6">
          {/* Step 1: Select Segment */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold mb-2">
                  Who do you want to reach?
                </h2>
                <p className="text-sm text-slate-500">
                  Select a customer segment for your campaign
                </p>
              </div>

              {loadingSegments ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                </div>
              ) : (
                <RadioGroup
                  value={selectedSegment}
                  onValueChange={setSelectedSegment}
                  className="space-y-3"
                >
                  {segments.map((segment) => (
                    <label
                      key={segment.id}
                      className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors ${
                        selectedSegment === segment.id
                          ? segment.id === "custom"
                            ? "border-purple-600 bg-purple-50"
                            : "border-blue-600 bg-blue-50"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <RadioGroupItem value={segment.id} />
                        <div className="flex items-center gap-2">
                          {segment.id === "custom" && (
                            <UserPlus className="h-4 w-4 text-purple-600" />
                          )}
                          <div>
                            <p className="font-medium">{segment.name}</p>
                            <p className="text-sm text-slate-500">
                              {segment.description}
                            </p>
                          </div>
                        </div>
                      </div>
                      <Badge
                        variant="secondary"
                        className={
                          segment.id === "custom"
                            ? "bg-purple-100 text-purple-700"
                            : ""
                        }
                      >
                        {segment.id === "custom"
                          ? `${customEmailCount} recipients`
                          : segment.count !== undefined
                            ? `${segment.count} customers`
                            : "Loading..."}
                      </Badge>
                    </label>
                  ))}
                </RadioGroup>
              )}

              {/* Custom emails textarea */}
              {selectedSegment === "custom" && (
                <div className="mt-4 space-y-2">
                  <Label htmlFor="customEmails">Email Addresses</Label>
                  <Textarea
                    id="customEmails"
                    value={customEmails}
                    onChange={(e) => setCustomEmails(e.target.value)}
                    placeholder="Enter email addresses (one per line)&#10;&#10;example@test.com&#10;another@test.com"
                    className="min-h-[120px] font-mono text-sm"
                  />
                  <p className="text-xs text-slate-500">
                    {customEmailCount} valid email{customEmailCount !== 1 ? "s" : ""} entered
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Select Template */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold mb-2">
                  Choose an email template
                </h2>
                <p className="text-sm text-slate-500">
                  Select the template for your campaign emails
                </p>
              </div>

              {loadingTemplates ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-8">
                  <Mail className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                  <p className="text-slate-500 mb-4">
                    No templates yet. Create one first.
                  </p>
                  <Link href="/outreach/templates/new">
                    <Button>Create Template</Button>
                  </Link>
                </div>
              ) : (
                <RadioGroup
                  value={selectedTemplate}
                  onValueChange={setSelectedTemplate}
                  className="space-y-3"
                >
                  {templates.map((template) => (
                    <label
                      key={template.id}
                      className={`flex items-start p-4 rounded-lg border cursor-pointer transition-colors ${
                        selectedTemplate === template.id
                          ? "border-blue-600 bg-blue-50"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <RadioGroupItem value={template.id} className="mt-1" />
                      <div className="ml-3">
                        <p className="font-medium">{template.name}</p>
                        <p className="text-sm text-slate-500 mt-1">
                          Subject: {template.subject}
                        </p>
                        <p className="text-xs text-slate-400 mt-2">
                          {template.variables?.length || 0} variables
                        </p>
                      </div>
                    </label>
                  ))}
                </RadioGroup>
              )}
            </div>
          )}

          {/* Step 3: Preview & Configure */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold mb-2">
                  Preview & Configure
                </h2>
                <p className="text-sm text-slate-500">
                  Review your campaign settings and preview exactly what each recipient will see
                </p>
              </div>

              {/* Campaign Settings Row */}
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Campaign Name</Label>
                  <Input
                    id="name"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="e.g., January Win-back"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fromName">From Name</Label>
                  <Input
                    id="fromName"
                    value={fromName}
                    onChange={(e) => setFromName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fromEmail">From Email</Label>
                  <Input
                    id="fromEmail"
                    value={fromEmail}
                    onChange={(e) => setFromEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Send Rate</Label>
                  <Select
                    value={sendRate.toString()}
                    onValueChange={(v) => setSendRate(parseInt(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SEND_RATES.map((rate) => (
                        <SelectItem
                          key={rate.value}
                          value={rate.value.toString()}
                        >
                          {rate.label} - {rate.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Summary Bar */}
              <div className="flex items-center gap-6 bg-slate-50 rounded-lg p-3 text-sm">
                <div>
                  <span className="text-slate-500">Segment:</span>{" "}
                  <span className="font-medium">{selectedSegmentInfo?.name}</span>
                </div>
                <div>
                  <span className="text-slate-500">Template:</span>{" "}
                  <span className="font-medium">{selectedTemplateInfo?.name}</span>
                </div>
                <div>
                  <span className="text-slate-500">Recipients:</span>{" "}
                  <span className="font-medium">{totalRecipients}</span>
                </div>
                <div>
                  <span className="text-slate-500">Est. Time:</span>{" "}
                  <span className="font-medium">{getEstimatedTime()}</span>
                </div>
              </div>

              {/* Full Email Preview with Navigation */}
              <div className="border rounded-lg">
                {/* Preview Header with Navigation */}
                <div className="flex items-center justify-between bg-slate-100 px-4 py-3 border-b">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-slate-500" />
                    <span className="font-medium">Email Preview</span>
                    {allRecipients.length > 0 && (
                      <Badge variant="secondary">
                        {previewIndex + 1} of {allRecipients.length}
                      </Badge>
                    )}
                  </div>
                  {allRecipients.length > 1 && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPreviewIndex(Math.max(0, previewIndex - 1))}
                        disabled={previewIndex === 0}
                      >
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPreviewIndex(Math.min(allRecipients.length - 1, previewIndex + 1))}
                        disabled={previewIndex === allRecipients.length - 1}
                      >
                        Next
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  )}
                </div>

                {allRecipients.length > 0 && allRecipients[previewIndex] ? (
                  <div>
                    {/* Email Headers */}
                    <div className="bg-white px-4 py-3 border-b space-y-1 text-sm">
                      <div>
                        <span className="text-slate-500 w-16 inline-block">To:</span>
                        <span className="font-medium text-blue-600">
                          {allRecipients[previewIndex].name} &lt;{allRecipients[previewIndex].email}&gt;
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 w-16 inline-block">From:</span>
                        <span>{fromName} &lt;{fromEmail}&gt;</span>
                      </div>
                      <div>
                        <span className="text-slate-500 w-16 inline-block">Subject:</span>
                        <span className="font-medium">{allRecipients[previewIndex].preview.subject}</span>
                      </div>
                    </div>

                    {/* Email Body - Full HTML Preview */}
                    <div className="bg-white p-4">
                      <div
                        className="border rounded-lg overflow-hidden"
                        style={{ minHeight: "400px" }}
                      >
                        <iframe
                          srcDoc={allRecipients[previewIndex].html_preview}
                          title="Email Preview"
                          className="w-full h-[400px] border-0"
                          sandbox="allow-same-origin"
                        />
                      </div>
                    </div>

                    {/* Personalization Data (Collapsible) */}
                    <details className="border-t">
                      <summary className="px-4 py-2 text-sm text-slate-500 cursor-pointer hover:bg-slate-50">
                        View Personalization Data
                      </summary>
                      <div className="px-4 py-2 bg-slate-50 text-xs font-mono">
                        <pre className="whitespace-pre-wrap">
                          {JSON.stringify(allRecipients[previewIndex].personalization, null, 2)}
                        </pre>
                      </div>
                    </details>
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-400">
                    <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No preview available</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Schedule & Launch */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold mb-2">
                  Schedule & Launch
                </h2>
                <p className="text-sm text-slate-500">
                  Choose when to send your campaign
                </p>
              </div>

              {/* Simulation Mode Toggle */}
              <div className={`p-4 rounded-lg border-2 ${isDryRun ? "border-purple-500 bg-purple-50" : "border-slate-200"}`}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox
                    id="dryRun"
                    checked={isDryRun}
                    onCheckedChange={(checked) => setIsDryRun(checked === true)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <FlaskConical className="h-4 w-4 text-purple-600" />
                      <span className="font-medium">Simulation Mode (Dry Run)</span>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                      Test your campaign without sending real emails. All emails will be marked as
                      &quot;sent&quot; but no actual delivery will occur. Great for testing templates and workflows.
                    </p>
                    {isDryRun && (
                      <div className="mt-2 p-2 bg-purple-100 rounded text-sm text-purple-700">
                        <strong>Note:</strong> No emails will be sent to recipients. This is a test run only.
                      </div>
                    )}
                  </div>
                </label>
              </div>

              <RadioGroup
                value={sendNow ? "now" : "scheduled"}
                onValueChange={(v) => setSendNow(v === "now")}
                className="space-y-3"
              >
                <label
                  className={`flex items-center p-4 rounded-lg border cursor-pointer ${
                    sendNow
                      ? "border-blue-600 bg-blue-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <RadioGroupItem value="now" />
                  <div className="ml-3">
                    <p className="font-medium flex items-center gap-2">
                      <Send className="h-4 w-4" />
                      Send Now
                    </p>
                    <p className="text-sm text-slate-500">
                      Start sending immediately at {sendRate} emails/hour
                    </p>
                  </div>
                </label>

                <label
                  className={`flex items-center p-4 rounded-lg border cursor-pointer ${
                    !sendNow
                      ? "border-blue-600 bg-blue-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <RadioGroupItem value="scheduled" />
                  <div className="ml-3">
                    <p className="font-medium flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Schedule
                    </p>
                    <p className="text-sm text-slate-500">
                      Choose a specific date and time
                    </p>
                  </div>
                </label>
              </RadioGroup>

              {!sendNow && (
                <div className="flex gap-4 pl-8">
                  <div className="space-y-2">
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="time">Time</Label>
                    <Input
                      id="time"
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Auto-Resend to Non-Openers */}
              <div className={`p-4 rounded-lg border-2 ${autoResendEnabled ? "border-amber-500 bg-amber-50" : "border-slate-200"}`}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox
                    id="autoResend"
                    checked={autoResendEnabled}
                    onCheckedChange={(checked) => setAutoResendEnabled(checked === true)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <RefreshCcw className="h-4 w-4 text-amber-600" />
                      <span className="font-medium">Send follow-up to non-openers</span>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                      Automatically re-send with a new subject line to recipients who
                      don&apos;t open the original email.
                    </p>
                  </div>
                </label>

                {autoResendEnabled && (
                  <div className="mt-4 ml-8 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="resendSubject">New Subject Line *</Label>
                      <Input
                        id="resendSubject"
                        value={resendSubject}
                        onChange={(e) => setResendSubject(e.target.value)}
                        placeholder="e.g., Did you see this? {{first_name}}"
                      />
                      <p className="text-xs text-slate-500">
                        Supports the same variables as your template (e.g. {"{{first_name}}"})
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Wait before resending</Label>
                      <Select
                        value={resendDelayHours.toString()}
                        onValueChange={(v) => setResendDelayHours(parseInt(v))}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RESEND_DELAYS.map((d) => (
                            <SelectItem key={d.value} value={d.value.toString()}>
                              {d.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              {/* Final Summary */}
              <Card className="bg-slate-50 border-slate-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Campaign Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-slate-500">Name</p>
                      <p className="font-medium">{campaignName}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Segment</p>
                      <p className="font-medium">{selectedSegmentInfo?.name}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Template</p>
                      <p className="font-medium">
                        {selectedTemplateInfo?.name}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Recipients</p>
                      <p className="font-medium">{totalRecipients}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">From</p>
                      <p className="font-medium">
                        {fromName} &lt;{fromEmail}&gt;
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Send Rate</p>
                      <p className="font-medium">{sendRate}/hour</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Est. Duration</p>
                      <p className="font-medium">{getEstimatedTime()}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Scheduled</p>
                      <p className="font-medium">
                        {sendNow
                          ? "Send immediately"
                          : scheduledDate
                            ? `${scheduledDate} ${scheduledTime}`
                            : "Not set"}
                      </p>
                    </div>
                    {isDryRun && (
                      <div className="col-span-2">
                        <p className="text-slate-500">Mode</p>
                        <p className="font-medium text-purple-600 flex items-center gap-1">
                          <FlaskConical className="h-4 w-4" />
                          Simulation (No real emails)
                        </p>
                      </div>
                    )}
                    {autoResendEnabled && (
                      <div className="col-span-2">
                        <p className="text-slate-500">Follow-up to Non-Openers</p>
                        <p className="font-medium text-amber-600 flex items-center gap-1">
                          <RefreshCcw className="h-4 w-4" />
                          Resend after {RESEND_DELAYS.find(d => d.value === resendDelayHours)?.label} with new subject
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={step === 1}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>

            <div className="flex gap-2">
              {step === 4 && (
                <Button
                  variant="outline"
                  onClick={() => handleLaunch(true)}
                  disabled={creating}
                >
                  Save as Draft
                </Button>
              )}

              {step < 4 ? (
                <Button onClick={handleNext} disabled={loading}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4 mr-2" />
                  )}
                  Next
                </Button>
              ) : (
                <Button onClick={() => handleLaunch(false)} disabled={creating}>
                  {creating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  {sendNow ? "Launch Campaign" : "Schedule Campaign"}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
