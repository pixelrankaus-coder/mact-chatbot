"use client";

import { useState, useEffect, use } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Save, Loader2, Eye, Variable, Link2 } from "lucide-react";
import { toast } from "sonner";
import {
  TEMPLATE_VARIABLES,
  renderTemplate,
  getSampleData,
} from "@/lib/outreach/templates";
import type { OutreachTemplate } from "@/types/outreach";

export default function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  // Link dialog state
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [selectedText, setSelectedText] = useState({ start: 0, end: 0, text: "" });

  const sampleData = getSampleData();
  const preview = renderTemplate({ subject, body }, sampleData);

  // Decode HTML entities and style links (same as email rendering)
  const decodeHtmlEntities = (text: string): string => {
    return text
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&');
  };

  const styleLinks = (html: string): string => {
    return html.replace(
      /<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi,
      '<a href="$1" style="color: #2563eb; text-decoration: underline;">$2</a>'
    );
  };

  const decodedBody = decodeHtmlEntities(preview.body);
  const bodyAsHtml = decodedBody
    .split("\n")
    .map((line) => {
      const styledLine = styleLinks(line);
      return `<p style="margin: 0 0 10px 0;">${styledLine || "&nbsp;"}</p>`;
    })
    .join("");

  useEffect(() => {
    fetchTemplate();
  }, [id]);

  const fetchTemplate = async () => {
    try {
      const res = await fetch(`/api/outreach/templates/${id}`);
      if (!res.ok) {
        throw new Error("Template not found");
      }
      const data = await res.json();
      const template: OutreachTemplate = data.template;

      setName(template.name);
      setSubject(template.subject);
      setBody(template.body);
    } catch (error) {
      console.error("Fetch error:", error);
      toast.error("Failed to load template");
      router.push("/outreach/templates");
    } finally {
      setLoading(false);
    }
  };

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById("body") as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newBody =
        body.substring(0, start) + `{{${variable}}}` + body.substring(end);
      setBody(newBody);

      setTimeout(() => {
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd =
          start + variable.length + 4;
      }, 0);
    } else {
      setBody(body + `{{${variable}}}`);
    }
  };

  const openLinkDialog = () => {
    const textarea = document.getElementById("body") as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = body.substring(start, end);
      setSelectedText({ start, end, text });
      setLinkText(text || "");
      setLinkUrl("");
    }
    setShowLinkDialog(true);
  };

  const insertLink = () => {
    if (!linkUrl) {
      toast.error("Please enter a URL");
      return;
    }

    // Add https:// if no protocol specified
    let url = linkUrl;
    if (!url.match(/^https?:\/\//)) {
      url = "https://" + url;
    }

    const text = linkText || url;
    const linkHtml = `<a href="${url}">${text}</a>`;

    const textarea = document.getElementById("body") as HTMLTextAreaElement;
    const start = selectedText.start;
    const end = selectedText.end;

    const newBody = body.substring(0, start) + linkHtml + body.substring(end);
    setBody(newBody);

    setShowLinkDialog(false);
    setLinkUrl("");
    setLinkText("");

    setTimeout(() => {
      if (textarea) {
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + linkHtml.length;
      }
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch(`/api/outreach/templates/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, subject, body }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to update template");
      }

      toast.success("Template updated");
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

  if (loading) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-6xl">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/outreach/templates">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Edit Template</h1>
          <p className="text-sm text-slate-500">
            Update your email template
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
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-sm gap-2"
                      onClick={openLinkDialog}
                    >
                      <Link2 className="h-4 w-4" />
                      Insert Link
                    </Button>
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
                  placeholder="Start writing your email..."
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
                  Save Changes
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
                    {preview.body ? (
                      <div
                        className="text-sm [&_a]:text-blue-600 [&_a]:underline"
                        dangerouslySetInnerHTML={{ __html: bodyAsHtml }}
                      />
                    ) : (
                      <div className="text-sm text-slate-400">
                        Start typing your email...
                      </div>
                    )}
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

      {/* Insert Link Dialog */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Insert Link</DialogTitle>
            <DialogDescription>
              Add a clickable hyperlink to your email template.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="linkUrl">URL</Label>
              <Input
                id="linkUrl"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://example.com"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="linkText">Link Text</Label>
              <Input
                id="linkText"
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                placeholder="Click here"
              />
              <p className="text-xs text-slate-500">
                Leave blank to use the URL as the text
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowLinkDialog(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={insertLink}>
              Insert Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
