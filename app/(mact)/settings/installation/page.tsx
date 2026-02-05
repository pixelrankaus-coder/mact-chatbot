"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Copy,
  Check,
  ExternalLink,
  Code,
  FileCode,
  Globe,
  CheckCircle2,
  XCircle,
  Loader2,
  Plug,
  ArrowRight,
  Info,
} from "lucide-react";

type InstallStatus = "not-installed" | "checking" | "installed" | "error";

export default function InstallationPage() {
  const [copied, setCopied] = useState(false);
  const [installStatus, setInstallStatus] = useState<InstallStatus>("not-installed");
  const [websiteUrl, setWebsiteUrl] = useState("https://mact.au");

  const embedCode = `<script src="https://widget.mact.au/chat.js" data-store-id="mact-store-001"></script>`;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(embedCode);
      setCopied(true);
      toast.success("Code copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy code");
    }
  };

  const handleCheckInstallation = () => {
    setInstallStatus("checking");
    // Simulate checking
    setTimeout(() => {
      // For demo, randomly show installed or not
      const isInstalled = Math.random() > 0.5;
      setInstallStatus(isInstalled ? "installed" : "not-installed");
      if (isInstalled) {
        toast.success("Widget is installed correctly!");
      } else {
        toast.error("Widget not detected on your website");
      }
    }, 2000);
  };

  const getStatusDisplay = () => {
    switch (installStatus) {
      case "checking":
        return (
          <div className="flex items-center gap-2 text-blue-600">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Checking installation...</span>
          </div>
        );
      case "installed":
        return (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="h-5 w-5" />
            <span>Widget installed successfully!</span>
          </div>
        );
      case "error":
        return (
          <div className="flex items-center gap-2 text-red-600">
            <XCircle className="h-5 w-5" />
            <span>Error checking installation</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2 text-slate-500">
            <XCircle className="h-5 w-5" />
            <span>Not installed</span>
          </div>
        );
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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
              <Code className="h-5 w-5 text-slate-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Install Chat Widget</h1>
              <p className="text-sm text-slate-500">Add the MACt chat widget to your website in just a few steps</p>
            </div>
          </div>
        </div>
      </div>

        <div className="p-6">
          <div className="max-w-3xl space-y-6">
            {/* Step 1: Copy Embed Code */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-600">
                    1
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    Copy the embed code
                  </h3>
                </div>
                <p className="mb-4 text-sm text-slate-600">
                  Copy this code snippet and paste it into your website, just before the closing{" "}
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm font-mono text-slate-700">
                    &lt;/body&gt;
                  </code>{" "}
                  tag.
                </p>

                {/* Code Block */}
                <div className="relative rounded-lg bg-slate-900 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Code className="h-4 w-4 text-slate-400" />
                      <span className="text-xs text-slate-400">HTML</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyCode}
                      className="h-8 gap-2 text-slate-300 hover:bg-slate-800 hover:text-white"
                    >
                      {copied ? (
                        <>
                          <Check className="h-4 w-4 text-green-400" />
                          <span className="text-green-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          Copy code
                        </>
                      )}
                    </Button>
                  </div>
                  <pre className="overflow-x-auto">
                    <code className="text-sm">
                      <span className="text-slate-500">&lt;</span>
                      <span className="text-red-400">script</span>
                      <span className="text-slate-500"> </span>
                      <span className="text-yellow-300">src</span>
                      <span className="text-slate-500">=</span>
                      <span className="text-green-400">&quot;https://widget.mact.au/chat.js&quot;</span>
                      <span className="text-slate-500"> </span>
                      <span className="text-yellow-300">data-store-id</span>
                      <span className="text-slate-500">=</span>
                      <span className="text-green-400">&quot;mact-store-001&quot;</span>
                      <span className="text-slate-500">&gt;&lt;/</span>
                      <span className="text-red-400">script</span>
                      <span className="text-slate-500">&gt;</span>
                    </code>
                  </pre>
                </div>

                <div className="mt-4 flex items-start gap-2 rounded-lg bg-blue-50 p-3">
                  <Info className="h-5 w-5 shrink-0 text-blue-600" />
                  <p className="text-sm text-blue-700">
                    Your store ID is <code className="font-mono font-semibold">mact-store-001</code>. This code is already configured for your account.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Step 2: WooCommerce Instructions */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-600">
                    2
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    For WooCommerce / WordPress
                  </h3>
                </div>

                <div className="space-y-4">
                  {/* Option A: Theme Editor */}
                  <div className="rounded-lg border bg-slate-50 p-4">
                    <h4 className="mb-3 font-medium text-slate-900">
                      Option A: Using Theme Editor
                    </h4>
                    <ol className="space-y-3 text-sm text-slate-600">
                      <li className="flex items-start gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-medium">
                          1
                        </span>
                        <span>
                          Go to <strong>Appearance</strong> <ArrowRight className="inline h-3 w-3" />{" "}
                          <strong>Theme File Editor</strong> in your WordPress admin
                        </span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-medium">
                          2
                        </span>
                        <span>
                          Select your theme and open <code className="rounded bg-white px-1.5 py-0.5 font-mono text-slate-700">footer.php</code>
                        </span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-medium">
                          3
                        </span>
                        <span>
                          Paste the embed code just before the closing{" "}
                          <code className="rounded bg-white px-1.5 py-0.5 font-mono text-slate-700">&lt;/body&gt;</code> tag
                        </span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-medium">
                          4
                        </span>
                        <span>Click <strong>Update File</strong> to save</span>
                      </li>
                    </ol>
                  </div>

                  {/* Screenshot Placeholder */}
                  <div className="rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                    <FileCode className="mx-auto h-12 w-12 text-slate-300" />
                    <p className="mt-2 text-sm text-slate-500">
                      Screenshot: Where to paste code in footer.php
                    </p>
                    <div className="mt-4 rounded bg-slate-100 p-3 text-left font-mono text-xs text-slate-600">
                      <div className="text-slate-400">...</div>
                      <div className="text-slate-400">&lt;footer&gt;...&lt;/footer&gt;</div>
                      <div className="mt-1 rounded bg-yellow-100 px-1 text-yellow-800">
                        &lt;script src=&quot;https://widget.mact.au/chat.js&quot;...&gt;&lt;/script&gt;
                      </div>
                      <div className="text-slate-400">&lt;/body&gt;</div>
                      <div className="text-slate-400">&lt;/html&gt;</div>
                    </div>
                  </div>

                  <Separator />

                  {/* Option B: Plugin */}
                  <div className="rounded-lg border bg-slate-50 p-4">
                    <h4 className="mb-3 font-medium text-slate-900">
                      Option B: Using a Plugin (Recommended)
                    </h4>
                    <p className="mb-3 text-sm text-slate-600">
                      If you prefer not to edit theme files, use the{" "}
                      <strong>Insert Headers and Footers</strong> plugin:
                    </p>
                    <ol className="space-y-3 text-sm text-slate-600">
                      <li className="flex items-start gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-medium">
                          1
                        </span>
                        <span>
                          Install and activate the{" "}
                          <a href="#" className="text-blue-600 hover:underline">
                            WPCode - Insert Headers and Footers
                          </a>{" "}
                          plugin
                        </span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-medium">
                          2
                        </span>
                        <span>
                          Go to <strong>Code Snippets</strong> <ArrowRight className="inline h-3 w-3" />{" "}
                          <strong>Header & Footer</strong>
                        </span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-medium">
                          3
                        </span>
                        <span>Paste the embed code in the <strong>Footer</strong> section</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-medium">
                          4
                        </span>
                        <span>Click <strong>Save Changes</strong></span>
                      </li>
                    </ol>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Step 3: Verify Installation */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-600">
                    3
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    Verify installation
                  </h3>
                </div>
                <p className="mb-4 text-sm text-slate-600">
                  After adding the code to your website, verify that the widget is working correctly.
                </p>

                <div className="mb-4">
                  <Label htmlFor="website-url" className="text-sm text-slate-600">
                    Your website URL
                  </Label>
                  <Input
                    id="website-url"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://yourwebsite.com"
                    className="mt-1 max-w-md"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <Button
                    onClick={handleCheckInstallation}
                    disabled={installStatus === "checking"}
                    className="gap-2 bg-blue-600 hover:bg-blue-700"
                  >
                    {installStatus === "checking" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Globe className="h-4 w-4" />
                    )}
                    Check Installation
                  </Button>

                  <div className="rounded-lg border bg-slate-50 px-4 py-2">
                    {getStatusDisplay()}
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="flex items-center gap-4">
                  <Button variant="outline" className="gap-2">
                    <ExternalLink className="h-4 w-4" />
                    Open my website
                  </Button>
                  <span className="text-sm text-slate-500">
                    Check if the chat widget appears on your site
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* WordPress Plugin Card - Coming Soon */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100">
                      <Plug className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        <h3 className="font-semibold text-slate-900">
                          MACt WordPress Plugin
                        </h3>
                        <Badge className="bg-purple-100 text-purple-700">
                          Coming Soon
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-600">
                        Install our official WordPress plugin for easier setup and additional features like WooCommerce order integration, customer data sync, and more.
                      </p>
                      <div className="mt-3 flex items-center gap-4">
                        <Button variant="outline" size="sm" disabled>
                          Download Plugin
                        </Button>
                        <a href="#" className="text-sm text-blue-600 hover:underline">
                          Learn more
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Help Section */}
            <div className="rounded-lg bg-slate-100 p-4">
              <p className="text-sm text-slate-600">
                Need help with installation?{" "}
                <a href="#" className="font-medium text-blue-600 hover:underline">
                  Contact our support team
                </a>{" "}
                or check out our{" "}
                <a href="#" className="font-medium text-blue-600 hover:underline">
                  installation guide
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      </div>
  );
}
