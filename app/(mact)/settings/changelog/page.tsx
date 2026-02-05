"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
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
    version: "1.4.0",
    date: "2025-01-19",
    type: "feature",
    title: "Chat Ratings & Feedback (TASK #031)",
    description:
      "Visitors can now rate their chat experience after 5 minutes of inactivity. Ratings help measure AI effectiveness and identify training gaps.",
    details: [
      "5-star rating prompt appears after 5 min inactivity",
      "Optional feedback textarea for additional comments",
      "Rating saved to database and visible in inbox",
      "LocalStorage prevents re-prompting same conversation",
      "Skip option for users who don't want to rate",
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
      "Smooth transition to chat after form submission",
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
      "Reduced line-height from 1.3 to 1.2",
      "Added display: inline-block to prevent bubble stretching",
      "Reduced avatar size from 28px to 24px",
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
      "Clean architecture with MActChatWidget extends HTMLElement",
      "Asymmetric border-radius on bubbles (Messenger-style)",
      "Handoff form for human agent requests",
      "System message styling",
    ],
  },
];

// Admin panel changelog
const adminChangelog: ChangelogEntry[] = [
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
      "Fix: Polling intervals reset bug - removed sendLogs from useEffect deps",
      "New campaign page now fetches default sender settings on mount",
      "Campaign creation API now reads defaults from settings table",
    ],
  },
  {
    version: "2.20.0",
    date: "2025-01-27",
    type: "feature",
    title: "Outreach Settings Page + Campaign List UI Refresh (TASK #059)",
    description:
      "Full settings page for Outreach module with sender config, reply handling, and sending rate limits. Plus redesigned campaign list with Klaviyo-inspired layout.",
    details: [
      "New /outreach/settings page with tabbed UI (General + Signature)",
      "Sender Settings: From Name, From Email, Default Reply-To",
      "Reply Handling: Forward Replies toggle with destination email",
      "Sending Settings: Emails Per Hour, Send Window Start/End",
      "API auto-creates default settings if none exist (singleton pattern)",
      "Campaign list redesigned with wider layout and filter row",
      "Dry Run badge shown next to campaign status",
      "Progress bar colors vary by status (green=completed, red=cancelled)",
      "Verified email tracking webhooks are properly configured",
    ],
  },
  {
    version: "2.19.0",
    date: "2025-01-25",
    type: "improvement",
    title: "Cin7 Sync Stores Product Line Items (TASK #058)",
    description:
      "Cin7 sync now fetches and stores full line item details for each order, enabling instant email personalization without on-demand API calls.",
    details: [
      "Enhanced syncCin7Orders() to fetch individual sale details",
      "Line items (name, SKU, quantity, price) now stored locally in cin7_orders.line_items",
      "Rate-limited API calls (5 concurrent, 500ms delay) to avoid Cin7 limits",
      "Customer email now captured from sale details (was missing from list API)",
      "Email preview {{last_product}} renders instantly from local data",
      "No more on-demand Cin7 API calls during campaign preview",
    ],
  },
  {
    version: "2.18.0",
    date: "2025-01-25",
    type: "feature",
    title: "Full Email Preview with Recipient Navigation (TASK #057)",
    description:
      "Campaign preview step now shows EXACTLY what each recipient will see, including full HTML email with signature and Previous/Next navigation to review all recipients.",
    details: [
      "Preview shows full HTML email in iframe (exactly as sent)",
      "Email signature included in preview",
      "Previous/Next buttons to navigate through ALL recipients",
      "Shows email headers: To, From, Subject with rendered values",
      "Collapsible personalization data viewer for debugging",
      "Compact settings layout with summary bar",
      "Fixed template regex to handle {{ variable }} with spaces",
    ],
  },
  {
    version: "2.17.0",
    date: "2025-01-24",
    type: "fix",
    title: "Fix Campaign Preview Template Variables + coupon_code Support",
    description:
      "Fixed woo_orders column names in segments.ts and added {{coupon_code}} as a supported template variable with fallback.",
    details: [
      "Fixed woo_orders queries: order_date (not date_created), customer_email (not billing_email)",
      "Added {{coupon_code}} variable with THANKYOU10 as default fallback",
      "Campaign preview now renders all variables correctly with real customer data",
      "Template editor shows coupon_code in variable dropdown",
    ],
  },
  {
    version: "2.16.0",
    date: "2025-01-24",
    type: "improvement",
    title: "Orders Page Now Reads from Local Cache",
    description:
      "Orders page now reads from Supabase cache instead of hitting WooCommerce API on every page load. Instant loading instead of waiting for 5000+ orders to sync.",
    details: [
      "WooCommerce orders now read from woo_orders table (synced via cron)",
      "Cin7 orders already read from cin7_orders table",
      "Both use server-side pagination (25 per page)",
      "Search and status filters work on cached data",
      "Page loads in ~200ms instead of 3-5 seconds",
    ],
  },
  {
    version: "2.15.0",
    date: "2025-01-24",
    type: "fix",
    title: "Fix Custom Email Personalization - WooCommerce Support",
    description:
      "Custom/test emails now look up order data from BOTH Cin7 AND WooCommerce, fixing missing {{last_product}} and {{last_order_date}} for WooCommerce-only customers.",
    details: [
      "Custom segment now queries cin7_customers, woo_customers, and woo_orders by email",
      "Also checks billing_email in woo_orders for guest checkout customers",
      "Combines order totals and counts from both systems",
      "Uses most recent order date/product across both systems",
      "Logs found order data for debugging",
    ],
  },
  {
    version: "2.14.0",
    date: "2025-01-24",
    type: "feature",
    title: "Add Outreach to Main Sidebar Navigation",
    description:
      "Outreach module now accessible from the main sidebar navigation with proper active state highlighting for all sub-pages.",
    details: [
      "Added Outreach (Mail icon) to main sidebar between Orders and AI Agent",
      "Active state highlights for all nested routes (/outreach/*)",
      "Quick access to Campaigns, Templates, Analytics, and Settings from one click",
    ],
  },
  {
    version: "2.13.0",
    date: "2025-01-24",
    type: "feature",
    title: "Unlayer Drag-and-Drop Email Signature Editor (TASK #056)",
    description:
      "Visual drag-and-drop editor for designing email signatures at /outreach/settings, using Unlayer (same as Klaviyo).",
    details: [
      "New Settings page accessible from Outreach navigation",
      "Unlayer react-email-editor integration with SSR disabled",
      "Design JSON saved to signature_json for re-editing",
      "Rendered HTML saved to signature_html for email sending",
      "Default signature pre-loaded matching Chris's Outlook signature",
      "Save, Reset to Default, and Preview functionality",
      "Modal preview shows full email with signature appended",
    ],
  },
  {
    version: "2.12.0",
    date: "2025-01-24",
    type: "feature",
    title: "Master Email Signature Template (TASK #055)",
    description:
      "HTML email support with professional signature auto-appended to all outreach emails, matching Chris's real Outlook signature.",
    details: [
      "Outreach emails now sent as HTML instead of plain text",
      "Professional signature with MACt branding auto-appended",
      "Signature includes logo, contact details, and service tags",
      "Signature stored in outreach_settings.signature_html (editable)",
      "Templates now only contain message body (no manual signature)",
      "Fallback values for empty template variables (e.g., 'our products')",
      "Plain text fallback included for email clients that don't support HTML",
    ],
  },
  {
    version: "2.11.0",
    date: "2025-01-24",
    type: "feature",
    title: "Outreach Real-time Send Logs + Delete Campaigns",
    description:
      "Real-time send logs displayed in the app UI during email campaigns, plus the ability to delete test campaigns.",
    details: [
      "New outreach_send_logs table stores detailed send logs per campaign",
      "Logs written to database during send (info, success, warning, error levels)",
      "Terminal-style log viewer on campaign detail page with auto-scroll",
      "Live polling (1.5s) shows logs in real-time while campaign is sending",
      "Color-coded log levels (green=success, red=error, yellow=warning)",
      "Delete button on campaigns list to remove failed/test campaigns",
      "Fixed segments.ts to use cin7_customers + cin7_orders tables",
      "Resend + Supabase integration supported for webhook events",
    ],
  },
  {
    version: "2.10.0",
    date: "2025-01-23",
    type: "feature",
    title: "Inbox Polish & Team System (TASK #043-046)",
    description:
      "Auto-resolve inactive chats, route protection middleware, and chat assignment system for team collaboration.",
    details: [
      "#043: Auto-resolve chats after 24h inactivity (POST /api/conversations/auto-resolve)",
      "#043: Resolved chats re-activate when visitor replies",
      "#044: Middleware protects /inbox, /customers, /settings, /orders routes",
      "#044: Logout button added to Account settings",
      "#045: Team management UI at /settings/team (already existed)",
      "#046: Assign dropdown in chat header with team member list",
      "#046: 'My Chats' and 'Unassigned' filters in inbox sidebar",
      "#046: Assigned agent badge shown on conversation list items",
    ],
  },
  {
    version: "2.9.0",
    date: "2025-01-22",
    type: "feature",
    title: "Dormant Customer Win-Back Campaign (TASK #040)",
    description:
      "Sync dormant customers to Klaviyo with full order history for personalized win-back email campaigns.",
    details: [
      "New 'Sync to Klaviyo' button on Customers page (Dormant segment)",
      "Bulk profile sync with customer segment tagging (total_orders, total_spent, days_since_last_order)",
      "Historical order events tracked as 'Placed Order' metric for flow triggers",
      "Real-time SSE progress updates during sync",
      "GET /api/klaviyo/sync-dormant for preview, POST to execute sync",
      "Profiles automatically subscribed to configured Klaviyo list",
    ],
  },
  {
    version: "2.8.1",
    date: "2025-01-22",
    type: "fix",
    title: "Fix Cin7 Sync Error Handling + Order Aggregates (TASK #039B)",
    description:
      "Fixed sync hanging on API errors and customer order totals showing $0.00.",
    details: [
      "Handle Cin7 API 200 OK responses with error messages in body",
      "Fix customers list order aggregates (Supabase 1000 row limit)",
      "Customer detail now uses Supabase cache for accurate order totals",
      "Propagate Cin7 API errors instead of silently returning empty results",
      "All 5,174 orders now correctly aggregated per customer",
    ],
  },
  {
    version: "2.8.0",
    date: "2025-01-22",
    type: "feature",
    title: "Fix Cin7 Sync + Configurable Settings (TASK #039)",
    description:
      "Removed sync page limits to fetch ALL data. Added configurable sync frequency and full/incremental sync modes.",
    details: [
      "Removed 50-page limit for orders sync (now fetches ALL orders)",
      "Removed 20-page limit for customers sync (now fetches ALL customers)",
      "Added Full Sync vs Quick Sync (incremental, last 30 days)",
      "Added sync frequency dropdown (15min, 1hr, 6hr, daily, manual)",
      "Cron now respects frequency settings (skips if not due)",
      "Shows last sync time and cached record counts",
      "Fixed missing 2024-2025 order data issue",
    ],
  },
  {
    version: "2.7.0",
    date: "2025-01-22",
    type: "feature",
    title: "Customers Page Enhancements (TASK #038)",
    description:
      "Enhanced customers page with order aggregates, segment filtering, sortable columns, tier badges, and activity dots.",
    details: [
      "Summary stats cards (Total, VIP, Active, Dormant, New, Marketable)",
      "Segment tabs for quick filtering (VIP: 5+ orders or $5K+, Active: 2+ orders in 6 months, etc.)",
      "New columns: Orders, Total Spent, Last Order date",
      "Sortable column headers (click to sort ascending/descending)",
      "Customer tier badges (🥇🥈🥉) based on order count and spend",
      "Activity status dots (green/yellow/red) based on recency",
      "Order aggregates calculated from cin7_orders and woo_orders tables",
    ],
  },
  {
    version: "2.6.0",
    date: "2025-01-22",
    type: "feature",
    title: "Cin7 Settings UI + Klaviyo Integration (TASK #036, #037)",
    description:
      "Cin7 credentials now configurable via UI. New Klaviyo integration tracks chat events for email marketing.",
    details: [
      "Cin7 config form with Account ID and API Key fields",
      "Cin7 test connection and real-time sync log (SSE streaming)",
      "Klaviyo integration for event tracking (chat started, handoff, rating)",
      "Klaviyo profile creation and list subscription",
      "Shared sync log panel shows progress for both Cin7 and WooCommerce",
    ],
  },
  {
    version: "2.5.1",
    date: "2025-01-22",
    type: "fix",
    title: "WooCommerce Guest Customers & SKU Display (TASK #035 cont.)",
    description:
      "Fixed WooCommerce sync to include guest checkout customers and display SKU in order line items.",
    details: [
      "Guest checkout customers now extracted from orders during sync",
      "SKU field added to order line items (was missing)",
      "Customers API now reads from woo_customers DB table (not API)",
      "Customer detail page works for guest customers (negative IDs)",
      "Orders for guest customers fetched by email from woo_orders",
    ],
  },
  {
    version: "2.5.0",
    date: "2025-01-20",
    type: "feature",
    title: "WooCommerce Settings UI + Real-time Sync Log (TASK #035)",
    description:
      "WooCommerce credentials can now be configured via UI instead of environment variables. Real-time sync progress is streamed via SSE.",
    details: [
      "WooCommerce config form with Store URL, Consumer Key, Consumer Secret",
      "Test Connection button to verify credentials before saving",
      "Credentials stored in integration_settings table (not env vars)",
      "Real-time sync log panel shows live progress via Server-Sent Events",
      "Enable/disable toggle for WooCommerce integration",
    ],
  },
  {
    version: "2.4.0",
    date: "2025-01-19",
    type: "feature",
    title: "WooCommerce Data Sync (TASK #034)",
    description:
      "WooCommerce orders and customers now sync to Supabase, matching the Cin7 caching pattern for consistent, fast lookups.",
    details: [
      "Created woo_orders and woo_customers tables in Supabase",
      "Unified cron job syncs both Cin7 and WooCommerce every 15 min",
      "Integrations page shows separate sync status cards for each",
      "Chatbot queries both caches for order lookups",
      "Manual sync buttons for immediate updates",
    ],
  },
  {
    version: "2.3.0",
    date: "2025-01-19",
    type: "fix",
    title: "Chatbot Uses Local Supabase Cache (TASK #033)",
    description:
      "Chatbot now reads order data from local Supabase cache instead of calling Cin7 API directly, fixing stale/wrong data issues.",
    details: [
      "Created chatbot-lookup.ts with Supabase queries",
      "Response time improved from 3-5s to ~200ms",
      "Order SO-05183 now returns correct status and tracking",
      "Tracking numbers displayed prominently in responses",
    ],
  },
  {
    version: "2.2.0",
    date: "2025-01-19",
    type: "feature",
    title: "Chat Ratings in Inbox (TASK #031)",
    description:
      "Ratings from widget now visible in inbox conversation list and sidebar detail view.",
    details: [
      "Star icon with rating number in conversation list",
      "5-star visualization in sidebar detail",
      "Feedback quote displayed when provided",
      "Analytics endpoint for rating distribution and trends",
    ],
  },
  {
    version: "2.1.0",
    date: "2025-01-19",
    type: "feature",
    title: "Cin7 Data Sync to Supabase (TASK #032)",
    description:
      "Background sync of Cin7 orders and customers to Supabase for faster page loads (~200ms vs 3-5s).",
    details: [
      "5,165 orders and 2,571 customers synced",
      "Automatic sync every 15 minutes via Vercel cron",
      "Manual sync buttons in Settings > Integrations",
      "Orders/Customers pages now read from local cache",
    ],
  },
  {
    version: "2.0.0",
    date: "2025-01-18",
    type: "feature",
    title: "Multi-LLM Provider Support (TASK #022)",
    description:
      "Support for multiple AI providers including OpenAI, Anthropic, Google, and Groq.",
    details: [
      "Provider selection in Settings > AI Provider",
      "Model selection per provider",
      "Temperature and max tokens configuration",
      "Token usage tracking and cost dashboard",
    ],
  },
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
      "Color picker with 8 preset colors + custom option",
      "Live widget preview panel",
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
    <div className="flex-1 overflow-auto bg-slate-50">
      <div className="border-b bg-white px-6 py-4">
        <Link href="/settings" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </Link>
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
  );
}
