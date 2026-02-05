"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Globe,
  Copy,
  Check,
  ExternalLink,
  QrCode,
  Share2,
  MessageSquare,
} from "lucide-react";

export default function ChatPageSettings() {
  const [copied, setCopied] = useState(false);
  const [chatPageEnabled, setChatPageEnabled] = useState(true);
  const [customSlug, setCustomSlug] = useState("mact-support");

  const chatPageUrl = `https://chat.mact.au/${customSlug}`;

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(chatPageUrl);
      setCopied(true);
      toast.success("URL copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy URL");
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-slate-50">
      <div className="border-b bg-white px-6 py-4">
        <div className="mb-6">
          <Link
            href="/settings"
            className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Settings
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
              <Globe className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Chat Page</h1>
              <p className="text-sm text-slate-500">Create a standalone chat page for your customers</p>
            </div>
          </div>
        </div>
      </div>

        <div className="p-6">
          <div className="max-w-3xl space-y-6">
            {/* Enable Chat Page */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                      <Globe className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        Enable Chat Page
                      </h3>
                      <p className="text-sm text-slate-500">
                        Allow customers to access chat via a dedicated URL
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={chatPageEnabled}
                    onCheckedChange={setChatPageEnabled}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Chat Page URL */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <h3 className="mb-4 font-semibold text-slate-900">
                  Your Chat Page URL
                </h3>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="slug" className="text-sm text-slate-600">
                      Custom URL Slug
                    </Label>
                    <div className="mt-1 flex gap-2">
                      <div className="flex flex-1 items-center rounded-lg border bg-slate-50">
                        <span className="px-3 text-sm text-slate-500">
                          https://chat.mact.au/
                        </span>
                        <Input
                          id="slug"
                          value={customSlug}
                          onChange={(e) => setCustomSlug(e.target.value)}
                          className="border-0 bg-transparent focus-visible:ring-0"
                          placeholder="your-store-name"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 rounded-lg border bg-white p-3">
                    <Globe className="h-4 w-4 text-slate-400" />
                    <span className="flex-1 text-sm text-slate-700">
                      {chatPageUrl}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyUrl}
                      className="gap-2"
                    >
                      {copied ? (
                        <>
                          <Check className="h-4 w-4 text-green-500" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          Copy
                        </>
                      )}
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-2">
                      <ExternalLink className="h-4 w-4" />
                      Open
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Share Options */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <h3 className="mb-4 font-semibold text-slate-900">
                  Share Your Chat Page
                </h3>

                <div className="grid gap-4 sm:grid-cols-3">
                  <Button variant="outline" className="h-auto flex-col gap-2 p-4">
                    <QrCode className="h-6 w-6 text-slate-600" />
                    <span className="text-sm">Download QR Code</span>
                  </Button>
                  <Button variant="outline" className="h-auto flex-col gap-2 p-4">
                    <Share2 className="h-6 w-6 text-slate-600" />
                    <span className="text-sm">Share Link</span>
                  </Button>
                  <Button variant="outline" className="h-auto flex-col gap-2 p-4">
                    <MessageSquare className="h-6 w-6 text-slate-600" />
                    <span className="text-sm">Email to Customers</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Preview */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <h3 className="mb-4 font-semibold text-slate-900">
                  Page Preview
                </h3>
                <div className="aspect-video rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center">
                  <div className="text-center">
                    <Globe className="mx-auto h-12 w-12 text-slate-300" />
                    <p className="mt-2 text-sm text-slate-500">
                      Chat page preview will appear here
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
  );
}
