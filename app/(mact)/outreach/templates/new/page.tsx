"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Save, Loader2, Eye, CreditCard } from "lucide-react";
import { toast } from "sonner";
import {
  renderTemplate,
  getSampleData,
} from "@/lib/outreach/templates";
import { bodyToEmailHtml } from "@/lib/outreach/body-to-html";
import { buildPaymentBlock } from "@/lib/outreach/payment-block";
import { TemplateEditor } from "@/components/outreach/template-editor";
import type { OutreachSignature } from "@/types/outreach";

export default function NewTemplatePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [includePaymentBlock, setIncludePaymentBlock] = useState(false);

  // Signature preview
  const [signatures, setSignatures] = useState<(OutreachSignature & { signature_html: string })[]>([]);
  const [previewSignatureId, setPreviewSignatureId] = useState<string>("");

  const sampleData = getSampleData();
  const preview = renderTemplate({ subject, body }, sampleData);
  const previewBodyHtml = bodyToEmailHtml(preview.body);

  useEffect(() => {
    fetchSignatures();
  }, []);

  const fetchSignatures = async () => {
    try {
      const res = await fetch("/api/outreach/signatures");
      const data = await res.json();
      setSignatures(data.signatures || []);
      if (data.default_signature_id) {
        setPreviewSignatureId(data.default_signature_id);
      }
    } catch (error) {
      console.error("Failed to fetch signatures:", error);
    }
  };

  const selectedSignatureHtml = signatures.find(s => s.id === previewSignatureId)?.signature_html || "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch("/api/outreach/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, subject, body, include_payment_block: includePaymentBlock }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create template");
      }

      toast.success("Template created");
      router.push("/outreach/templates");
    } catch (error) {
      console.error("Save error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save template"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-[1500px]">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/outreach/templates">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">New Template</h1>
          <p className="text-sm text-slate-500">
            Create a new email template for outreach campaigns
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Editor */}
          <Card>
            <CardHeader>
              <CardTitle>Template Editor</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Personal Check-in"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Subject Line</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g., Quick question about your {{last_product}} project"
                  required
                />
              </div>

              {/* WYSIWYG Editor */}
              <TemplateEditor body={body} onChange={setBody} />

              {/* Payment Block Toggle */}
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-slate-500" />
                  <div>
                    <Label htmlFor="paymentBlock" className="text-sm font-medium">
                      Include Payment Details
                    </Label>
                    <p className="text-xs text-slate-500">
                      Adds Bpoint link &amp; bank transfer details to the email
                    </p>
                  </div>
                </div>
                <Switch
                  id="paymentBlock"
                  checked={includePaymentBlock}
                  onCheckedChange={setIncludePaymentBlock}
                />
              </div>

              {/* Signature Preview Selector */}
              {signatures.length > 0 && (
                <div className="space-y-2 pt-2 border-t">
                  <Label>Signature Preview</Label>
                  <Select
                    value={previewSignatureId}
                    onValueChange={setPreviewSignatureId}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="No signature" />
                    </SelectTrigger>
                    <SelectContent>
                      {signatures.map((sig) => (
                        <SelectItem key={sig.id} value={sig.id}>
                          {sig.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500">
                    For preview only. Signature is selected when creating a campaign.
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button type="submit" disabled={saving} className="gap-2">
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save Template
                </Button>
                <Link href="/outreach/templates">
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Preview
                </CardTitle>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPreview(!showPreview)}
                >
                  {showPreview ? "Hide" : "Show"}
                </Button>
              </div>
            </CardHeader>
            {showPreview && (
              <CardContent>
                <div className="bg-slate-50 rounded-lg p-4 space-y-4 font-[family-name:var(--font-poppins)]">
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">
                      Subject
                    </p>
                    <p className="font-medium">
                      {preview.subject || (
                        <span className="text-slate-400">
                          Enter a subject...
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">
                      Body
                    </p>
                    {preview.body ? (
                      <div
                        className="text-sm [&_a]:text-blue-600 [&_a]:underline"
                        dangerouslySetInnerHTML={{ __html: previewBodyHtml }}
                      />
                    ) : (
                      <div className="text-sm text-slate-400">
                        Start typing your email...
                      </div>
                    )}
                  </div>
                  {includePaymentBlock && (
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">
                        Payment Details
                      </p>
                      <div
                        className="text-sm"
                        dangerouslySetInnerHTML={{
                          __html: buildPaymentBlock({
                            invoiceNumber: String(sampleData.invoice_number),
                            amountDue: sampleData.amount_due as number,
                          }),
                        }}
                      />
                    </div>
                  )}
                  {selectedSignatureHtml && (
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">
                        Signature
                      </p>
                      <div
                        className="text-sm"
                        dangerouslySetInnerHTML={{ __html: selectedSignatureHtml }}
                      />
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs text-slate-400 mb-2">
                    Sample data used in preview:
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {Object.entries(sampleData).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-2">
                        <code className="text-blue-600">{`{{${key}}}`}</code>
                        <span className="text-slate-500">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      </form>
    </div>
  );
}
