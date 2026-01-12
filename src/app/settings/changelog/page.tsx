"use client";

import { SettingsSidebar } from "@/components/settings";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bug,
  Sparkles,
  Wrench,
  AlertCircle,
  CheckCircle2,
  Code,
  Lightbulb,
  MessageCircle,
  Layout,
} from "lucide-react";
import { ADMIN_VERSION, WIDGET_VERSION } from "@/lib/version";

interface ChangelogEntry {
  version: string;
  date: string;
  type: "fix" | "feature" | "improvement" | "breaking";
  title: string;
  description: string;
  details?: string[];
  codeChanges?: {
    before: string;
    after: string;
  };
}

// Widget changelog
const widgetChangelog: ChangelogEntry[] = [
  {
    version: "2.0.3",
    date: "2025-01-12",
    type: "fix",
    title: "Fixed Chunky Chat Bubbles",
    description:
      "Resolved the issue where chat message bubbles appeared too 'chunky' and fat compared to professional chat widgets like Tidio, WhatsApp, and Facebook Messenger.",
    details: [
      "Reduced gap between messages from 12px to 6px",
      "Reduced line-height from 1.3 to 1.2",
      "Added display: inline-block to prevent bubble stretching",
      "Removed white-space: pre-wrap which was adding extra space",
      "Reduced avatar size from 28px to 24px",
      "Tightened horizontal padding from 12px to 10px",
    ],
    codeChanges: {
      before: `.mact-messages { gap: 12px; }
.mact-bubble { padding: 6px 12px; line-height: 1.3; white-space: pre-wrap; }
.mact-avatar { width: 28px; height: 28px; }`,
      after: `.mact-messages { gap: 6px; }
.mact-bubble { padding: 6px 10px; line-height: 1.2; display: inline-block; }
.mact-avatar { width: 24px; height: 24px; }`,
    },
  },
  {
    version: "2.0.2",
    date: "2025-01-12",
    type: "improvement",
    title: "Bubble Width Adjustment",
    description: "Reduced max-width and line-height for sleeker appearance.",
    details: [
      "Reduced max-width from 85% to 70%",
      "Reduced line-height from 1.4 to 1.3",
      "Verified CORS headers on all widget API routes",
    ],
  },
  {
    version: "2.0.1",
    date: "2025-01-12",
    type: "improvement",
    title: "Bubble Padding Reduction",
    description: "Initial attempt to reduce bubble chunkiness.",
    details: [
      "Reduced bubble padding from 10px 14px to 6px 12px",
      "Reduced border-radius from 18px to 16px",
    ],
  },
  {
    version: "2.0.0",
    date: "2025-01-12",
    type: "feature",
    title: "V2 Widget - Complete Rebuild",
    description:
      "Complete rebuild of the chat widget using Web Components (Custom Elements + Shadow DOM) for true CSS isolation.",
    details: [
      "True CSS isolation - WordPress/host site styles cannot affect widget",
      "Clean architecture with MActChatWidget extends HTMLElement",
      "Asymmetric border-radius on bubbles (Messenger-style 'tail' effect)",
      "Handoff form for 'Talk to a human' functionality",
      "System message styling",
    ],
  },
  {
    version: "1.2.0",
    date: "2025-01-11",
    type: "improvement",
    title: "Flexbox Layout Refactor",
    description:
      "Attempted flexbox layout based on Facebook Messenger research.",
    details: [
      "Changed from inline-block to flexbox with align-self",
      "Based on ishadeed.com/article/facebook-messenger-chat-component",
    ],
  },
];

// Admin panel changelog
const adminChangelog: ChangelogEntry[] = [
  {
    version: "1.0.0",
    date: "2025-01-12",
    type: "feature",
    title: "Tidio-Style Appearance Settings",
    description:
      "Redesigned the appearance settings page to match Tidio's professional UI.",
    details: [
      "Clean collapsible sections with smooth animations",
      "Desktop/Mobile tabs with visual position selectors",
      "Phone outline icons for mobile position preview",
      "Button size slider (small/medium/large) for mobile",
      "Color picker with 8 preset colors + custom option",
      "Live widget preview panel with checkered background",
      "Version numbers displayed in settings sidebar footer",
      "Changelog page with full version history",
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

function ChangelogEntryCard({ entry }: { entry: ChangelogEntry }) {
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
          </div>
          <span className="text-sm text-slate-500">{entry.date}</span>
        </div>

        <h3 className="mt-3 text-lg font-semibold text-slate-900">
          {entry.title}
        </h3>
        <p className="mt-1 text-slate-600">{entry.description}</p>

        {entry.details && (
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

        {entry.codeChanges && (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="mb-2 flex items-center gap-1 text-sm font-medium text-red-700">
                <Code className="h-4 w-4" />
                Before
              </h4>
              <pre className="overflow-x-auto rounded-lg bg-red-50 p-3 text-xs text-red-900">
                {entry.codeChanges.before}
              </pre>
            </div>
            <div>
              <h4 className="mb-2 flex items-center gap-1 text-sm font-medium text-green-700">
                <Code className="h-4 w-4" />
                After
              </h4>
              <pre className="overflow-x-auto rounded-lg bg-green-50 p-3 text-xs text-green-900">
                {entry.codeChanges.after}
              </pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ChangelogPage() {
  return (
    <div className="flex h-full">
      <SettingsSidebar />

      <div className="flex-1 overflow-auto bg-slate-50">
        <div className="border-b bg-white px-6 py-4">
          <h1 className="text-xl font-semibold text-slate-900">Changelog</h1>
          <p className="text-sm text-slate-500">
            Version history and updates for MACt
          </p>
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
              </CardContent>
            </Card>

            {/* Tabs for Widget vs Admin changelog */}
            <Tabs defaultValue="widget" className="w-full">
              <TabsList className="mb-6 grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="widget" className="gap-2">
                  <MessageCircle className="h-4 w-4" />
                  Widget
                </TabsTrigger>
                <TabsTrigger value="admin" className="gap-2">
                  <Layout className="h-4 w-4" />
                  Admin Panel
                </TabsTrigger>
              </TabsList>

              <TabsContent value="widget" className="space-y-6">
                {/* Key Insight Card */}
                <Card className="border-0 border-l-4 border-l-amber-400 bg-amber-50 shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-3">
                      <Lightbulb className="mt-0.5 h-5 w-5 text-amber-600" />
                      <div>
                        <h3 className="font-semibold text-amber-900">
                          Key Learning: Chunky Bubbles Fix
                        </h3>
                        <p className="mt-1 text-sm text-amber-800">
                          The &quot;chunky&quot; look wasn&apos;t any single CSS
                          property - it was the <strong>cumulative effect</strong>{" "}
                          of: gap between messages, line-height within text,
                          bubble stretching (missing inline-block), and large
                          avatars. All these small reductions compound into a
                          sleek, professional look.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Widget Changelog Entries */}
                {widgetChangelog.map((entry) => (
                  <ChangelogEntryCard key={entry.version} entry={entry} />
                ))}

                {/* Research Notes */}
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-6">
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                      <Lightbulb className="h-5 w-5 text-amber-500" />
                      Research Notes
                    </h3>
                    <p className="mt-2 text-slate-600">
                      How professional chat widgets style bubbles:
                    </p>
                    <div className="mt-4 space-y-4">
                      <div className="rounded-lg bg-slate-50 p-4">
                        <h4 className="font-medium text-slate-900">
                          Facebook Messenger
                        </h4>
                        <p className="mt-1 text-sm text-slate-600">
                          Uses flexbox on message container, flex-direction:
                          column on messages wrapper, align-self: flex-end/start
                          for sent/received alignment, max-width constraint on
                          bubbles.
                        </p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-4">
                        <h4 className="font-medium text-slate-900">
                          WhatsApp / Tidio Pattern
                        </h4>
                        <ul className="mt-1 space-y-1 text-sm text-slate-600">
                          <li>Padding: ~6px 12px (tight vertical)</li>
                          <li>Line-height: 1.2 - 1.3</li>
                          <li>Border-radius: 16px with asymmetric corners</li>
                          <li>Gap between messages: 4px - 8px</li>
                          <li>Avatar size: 24px - 28px</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="admin" className="space-y-6">
                {/* Admin Changelog Entries */}
                {adminChangelog.map((entry) => (
                  <ChangelogEntryCard key={entry.version} entry={entry} />
                ))}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
