"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  RefreshCw,
  Database,
  Brain,
  Plug,
  Mail,
  TrendingUp,
  CheckCircle,
  XCircle,
  AlertTriangle,
  CircleDashed,
  ArrowDown,
  Globe,
  Server,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ADMIN_VERSION, WIDGET_VERSION } from "@/lib/version";

interface ServiceHealth {
  name: string;
  type: "database" | "ai" | "integration" | "email" | "advertising";
  status: "operational" | "degraded" | "down" | "unconfigured";
  responseTime: number | null;
  details?: string;
  url?: string;
}

interface HealthData {
  services: ServiceHealth[];
  summary: {
    total: number;
    operational: number;
    degraded: number;
    down: number;
    unconfigured: number;
    configured: number;
  };
  checkedAt: string;
  totalCheckTime: number;
}

const STATUS_CONFIG = {
  operational: { icon: CheckCircle, color: "text-green-500", bg: "bg-green-500", label: "Operational", dot: "bg-green-500" },
  degraded: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500", label: "Degraded", dot: "bg-amber-500" },
  down: { icon: XCircle, color: "text-red-500", bg: "bg-red-500", label: "Down", dot: "bg-red-500" },
  unconfigured: { icon: CircleDashed, color: "text-slate-400", bg: "bg-slate-400", label: "Not Configured", dot: "bg-slate-300" },
};

const SERVICE_META: Record<string, { description: string; stack?: string; icon: React.ElementType; color: string }> = {
  "Supabase": { description: "PostgreSQL database, auth & realtime", stack: "PostgreSQL", icon: Database, color: "bg-emerald-100 text-emerald-700" },
  "OpenAI": { description: "Primary LLM provider", stack: "GPT-4o", icon: Brain, color: "bg-violet-100 text-violet-700" },
  "Anthropic": { description: "Alternative LLM provider", stack: "Claude 3.5", icon: Brain, color: "bg-orange-100 text-orange-700" },
  "DeepSeek": { description: "Cost-effective LLM provider", stack: "DeepSeek Chat", icon: Brain, color: "bg-blue-100 text-blue-700" },
  "WooCommerce": { description: "E-commerce platform", stack: "REST API v3", icon: Plug, color: "bg-purple-100 text-purple-700" },
  "Cin7": { description: "Inventory & order management", stack: "REST API v2", icon: Plug, color: "bg-cyan-100 text-cyan-700" },
  "Klaviyo": { description: "Email marketing & CDP", stack: "API 2024-10", icon: Mail, color: "bg-green-100 text-green-700" },
  "Resend": { description: "Transactional email delivery", icon: Mail, color: "bg-rose-100 text-rose-700" },
  "Google Ads": { description: "PPC campaign management", stack: "Ads API v23", icon: TrendingUp, color: "bg-yellow-100 text-yellow-700" },
};

function ServiceCard({ service }: { service: ServiceHealth }) {
  const statusCfg = STATUS_CONFIG[service.status];
  const meta = SERVICE_META[service.name] || { description: "", icon: Plug, color: "bg-slate-100 text-slate-700" };
  const Icon = meta.icon;
  const StatusIcon = statusCfg.icon;

  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${meta.color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex items-center gap-2">
          {service.responseTime !== null && (
            <span className="text-xs text-slate-400 font-mono">{service.responseTime}ms</span>
          )}
          <StatusIcon className={`h-4 w-4 ${statusCfg.color}`} />
        </div>
      </div>
      <div>
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-slate-900">{service.name}</h3>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {statusCfg.label}
          </Badge>
        </div>
        <p className="text-xs text-slate-500 mt-1">{meta.description}</p>
      </div>
      <div className="mt-3 pt-3 border-t border-slate-100">
        <div className="flex items-center justify-between text-xs">
          {meta.stack && (
            <span className="text-slate-400">Stack: <span className="text-slate-600">{meta.stack}</span></span>
          )}
          {!meta.stack && <span />}
          {service.url && (
            <span className="text-slate-400 truncate max-w-[160px]">{service.url.replace("https://", "")}</span>
          )}
          {service.details && !service.url && (
            <span className="text-slate-400 truncate max-w-[200px]">{service.details}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function LayerDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-2">
      <ArrowDown className="h-4 w-4 text-slate-300" />
      <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</span>
      <ArrowDown className="h-4 w-4 text-slate-300" />
    </div>
  );
}

export default function InfrastructurePage() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHealth = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch("/api/infrastructure/health");
      if (!res.ok) throw new Error("Failed to fetch health");
      const result = await res.json();
      setData(result);
    } catch (err) {
      console.error("Health check error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  const aiServices = data?.services.filter((s) => s.type === "ai") || [];
  const integrationServices = data?.services.filter((s) => s.type === "integration") || [];
  const emailServices = data?.services.filter((s) => s.type === "email") || [];
  const adServices = data?.services.filter((s) => s.type === "advertising") || [];
  const dbServices = data?.services.filter((s) => s.type === "database") || [];

  const allOperational = data?.summary.down === 0 && data?.summary.degraded === 0;
  const configuredServices = data?.services.filter((s) => s.status !== "unconfigured") || [];

  return (
    <div className="flex-1 overflow-auto bg-slate-50">
      {/* Header */}
      <div className="border-b bg-white px-6 py-4">
        <Link href="/settings" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900">
              <Server className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Infrastructure Map</h1>
              <p className="text-sm text-slate-500">
                Complete overview of the MACt platform architecture
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchHealth(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="p-6">
        {/* Status Bar */}
        <div className="rounded-xl border bg-white p-4 shadow-sm mb-6">
          {loading ? (
            <div className="flex items-center gap-4">
              <Skeleton className="h-5 w-40" />
              <div className="flex gap-3 ml-auto">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-5 w-24" />
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                {allOperational ? (
                  <>
                    <div className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-sm font-medium text-green-700">All services operational</span>
                  </>
                ) : (
                  <>
                    <div className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
                    <span className="text-sm font-medium text-amber-700">
                      {data?.summary.down || 0} service{(data?.summary.down || 0) !== 1 ? "s" : ""} down
                      {(data?.summary.degraded || 0) > 0 && `, ${data?.summary.degraded} degraded`}
                    </span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-4 flex-wrap">
                <TooltipProvider>
                  {configuredServices.map((service) => {
                    const cfg = STATUS_CONFIG[service.status];
                    return (
                      <Tooltip key={service.name}>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1.5 cursor-default">
                            <div className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                            <span className="text-xs text-slate-600">{service.name}</span>
                            {service.responseTime !== null && (
                              <span className="text-[10px] text-slate-400 font-mono">{service.responseTime}ms</span>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{service.name}: {cfg.label}</p>
                          {service.details && <p className="text-xs opacity-70">{service.details}</p>}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </TooltipProvider>

                {data?.checkedAt && (
                  <span className="text-xs text-slate-400">
                    Last checked {new Date(data.checkedAt).toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="space-y-6">
            {[1, 2, 3, 4].map((section) => (
              <div key={section}>
                <Skeleton className="h-5 w-32 mb-4" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-40 rounded-xl" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {/* Application Layer */}
            <div className="mb-2">
              <div className="flex items-center gap-2 mb-4">
                <Globe className="h-4 w-4 text-slate-400" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Application Layer</h2>
              </div>
              <div className="rounded-xl border bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-900">
                      <Globe className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-slate-900">MACt Dashboard</h3>
                        <Badge className="bg-green-100 text-green-700">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Live
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-500">Internal management dashboard & AI chatbot</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-100">
                  <div>
                    <p className="text-xs text-slate-400">Stack</p>
                    <p className="text-sm font-medium text-slate-700">Next.js 15 + React</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Hosting</p>
                    <p className="text-sm font-medium text-slate-700">Vercel</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Version</p>
                    <p className="text-sm font-medium text-slate-700">Admin v{ADMIN_VERSION}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Widget</p>
                    <p className="text-sm font-medium text-slate-700">v{WIDGET_VERSION}</p>
                  </div>
                </div>
              </div>
            </div>

            <LayerDivider label="HTTPS / REST API" />

            {/* AI Layer */}
            <div className="mb-2">
              <div className="flex items-center gap-2 mb-4">
                <Brain className="h-4 w-4 text-slate-400" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">AI Layer</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {aiServices.map((service) => (
                  <ServiceCard key={service.name} service={service} />
                ))}
              </div>
            </div>

            <LayerDivider label="API Integrations" />

            {/* Integration Layer */}
            <div className="mb-2">
              <div className="flex items-center gap-2 mb-4">
                <Plug className="h-4 w-4 text-slate-400" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Integration Layer</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...integrationServices, ...adServices].map((service) => (
                  <ServiceCard key={service.name} service={service} />
                ))}
              </div>
            </div>

            <LayerDivider label="Email Services" />

            {/* Email Layer */}
            <div className="mb-2">
              <div className="flex items-center gap-2 mb-4">
                <Mail className="h-4 w-4 text-slate-400" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Email Layer</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {emailServices.map((service) => (
                  <ServiceCard key={service.name} service={service} />
                ))}
              </div>
            </div>

            <LayerDivider label="Supabase Client / ORM" />

            {/* Data Layer */}
            <div className="mb-2">
              <div className="flex items-center gap-2 mb-4">
                <Database className="h-4 w-4 text-slate-400" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Data Layer</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dbServices.map((service) => (
                  <ServiceCard key={service.name} service={service} />
                ))}
                {/* Database tables summary */}
                <div className="rounded-xl border bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                      <Database className="h-5 w-5" />
                    </div>
                  </div>
                  <h3 className="font-semibold text-slate-900">Database Tables</h3>
                  <p className="text-xs text-slate-500 mt-1 mb-3">Core data tables in Supabase</p>
                  <div className="grid grid-cols-2 gap-1 text-xs text-slate-600">
                    <span>conversations</span>
                    <span>messages</span>
                    <span>visitors</span>
                    <span>knowledge_base</span>
                    <span>orders</span>
                    <span>customers</span>
                    <span>cin7_orders</span>
                    <span>cin7_customers</span>
                    <span>woo_orders</span>
                    <span>woo_customers</span>
                    <span>woo_products</span>
                    <span>integration_settings</span>
                    <span>outreach_campaigns</span>
                    <span>outreach_emails</span>
                    <span>settings</span>
                    <span>sync_log</span>
                    <span>ai_skills</span>
                    <span>ppc_connections</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
