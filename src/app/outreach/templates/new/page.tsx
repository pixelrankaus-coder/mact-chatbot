"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save, Loader2, Eye, Variable } from "lucide-react";
import { toast } from "sonner";
import {
  TEMPLATE_VARIABLES,
  renderTemplate,
  getSampleData,
} from "@/lib/outreach/templates";

export default function NewTemplatePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const sampleData = getSampleData();
  const preview = renderTemplate({ subject, body }, sampleData);

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById("body") as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newBody =
        body.substring(0, start) + `{{${variable}}}` + body.substring(end);
      setBody(newBody);

      // Reset cursor position after React re-render
      setTimeout(() => {
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd =
          start + variable.length + 4;
      }, 0);
    } else {
      setBody(body + `{{${variable}}}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch("/api/outreach/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, subject, body }),
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
    <div className="container mx-auto py-6 px-4 max-w-6xl">
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

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="body">Email Body</Label>
                  <div className="flex items-center gap-2">
                    <Select onValueChange={insertVariable}>
                      <SelectTrigger className="w-[180px] h-8 text-sm">
                        <Variable className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Insert Variable" />
                      </SelectTrigger>
                      <SelectContent>
                        {TEMPLATE_VARIABLES.map((v) => (
                          <SelectItem key={v.key} value={v.key}>
                            <span className="font-mono text-sm">
                              {`{{${v.key}}}`}
                            </span>
                            <span className="text-slate-400 ml-2 text-xs">
                              {v.example}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Textarea
                  id="body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={`Hi {{first_name}},\n\nIt's been a while since you grabbed that {{last_product}}. I'd love to know how that project turned out!\n\nCheers,\nChris`}
                  className="min-h-[300px] font-mono text-sm"
                  required
                />
              </div>

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
                <div className="bg-slate-50 rounded-lg p-4 space-y-4">
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
                    <div className="whitespace-pre-wrap text-sm">
                      {preview.body || (
                        <span className="text-slate-400">
                          Start typing your email...
                        </span>
                      )}
                    </div>
                  </div>
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
