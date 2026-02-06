"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Zap,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  Package,
  Ticket,
  Users,
  ShoppingCart,
  Database,
  Mail,
  TrendingUp,
  Send,
  MessageSquare,
  DollarSign,
  Calendar,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

// Icon mapping for skill icons
const iconMap: Record<string, React.ReactNode> = {
  Package: <Package className="h-5 w-5" />,
  Ticket: <Ticket className="h-5 w-5" />,
  Users: <Users className="h-5 w-5" />,
  ShoppingCart: <ShoppingCart className="h-5 w-5" />,
  Database: <Database className="h-5 w-5" />,
  Mail: <Mail className="h-5 w-5" />,
  TrendingUp: <TrendingUp className="h-5 w-5" />,
  Send: <Send className="h-5 w-5" />,
  MessageSquare: <MessageSquare className="h-5 w-5" />,
  DollarSign: <DollarSign className="h-5 w-5" />,
  Calendar: <Calendar className="h-5 w-5" />,
  FileText: <FileText className="h-5 w-5" />,
  Zap: <Zap className="h-5 w-5" />,
};

// Color mapping for skill icons
const colorMap: Record<string, string> = {
  blue: "bg-blue-100 text-blue-600",
  green: "bg-green-100 text-green-600",
  purple: "bg-purple-100 text-purple-600",
  orange: "bg-orange-100 text-orange-600",
  yellow: "bg-yellow-100 text-yellow-600",
  indigo: "bg-indigo-100 text-indigo-600",
  teal: "bg-teal-100 text-teal-600",
  gray: "bg-slate-100 text-slate-600",
};

interface Skill {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon_name: string;
  icon_color: string;
  category: string;
  requires_integration: string | null;
  capabilities: string[];
  is_available: boolean;
  is_enabled: boolean;
  connection_status: "connected" | "disconnected" | "not_required";
}

interface SkillCategory {
  category: string;
  label: string;
  icon: string;
  order: number;
  skills: Skill[];
}

interface SkillsData {
  categories: SkillCategory[];
  skills: Skill[];
  summary: {
    total: number;
    enabled: number;
    available: number;
    connected: number;
  };
}

export function SkillsTab() {
  const [data, setData] = useState<SkillsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(["customer_support", "ecommerce"]));
  const [togglingSkill, setTogglingSkill] = useState<string | null>(null);

  // Fetch skills data
  useEffect(() => {
    async function fetchSkills() {
      try {
        const res = await fetch("/api/skills");
        if (!res.ok) throw new Error("Failed to fetch skills");
        const skillsData = await res.json();
        setData(skillsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load skills");
      } finally {
        setLoading(false);
      }
    }

    fetchSkills();
  }, []);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const toggleSkill = async (skill: Skill) => {
    if (!skill.is_available) return;

    // If trying to enable and requires disconnected integration
    if (!skill.is_enabled && skill.connection_status === "disconnected") {
      toast.error(`Connect ${skill.requires_integration} first`, {
        description: "Go to Settings → Integrations to connect",
        action: {
          label: "Go to Integrations",
          onClick: () => window.location.href = "/settings/integrations",
        },
      });
      return;
    }

    setTogglingSkill(skill.id);

    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skill_id: skill.id,
          is_enabled: !skill.is_enabled,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Failed to toggle skill");
      }

      // Update local state
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          categories: prev.categories.map((cat) => ({
            ...cat,
            skills: cat.skills.map((s) =>
              s.id === skill.id ? { ...s, is_enabled: !skill.is_enabled } : s
            ),
          })),
          skills: prev.skills.map((s) =>
            s.id === skill.id ? { ...s, is_enabled: !skill.is_enabled } : s
          ),
          summary: {
            ...prev.summary,
            enabled: prev.summary.enabled + (skill.is_enabled ? -1 : 1),
          },
        };
      });

      toast.success(result.message || `${skill.name} ${!skill.is_enabled ? "enabled" : "disabled"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to toggle skill");
    } finally {
      setTogglingSkill(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm text-slate-500">Loading skills...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertCircle className="h-8 w-8 text-red-500" />
          <p className="text-sm text-slate-700">{error}</p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header / Explanation Banner */}
        <Card className="border-0 bg-gradient-to-r from-blue-50 to-purple-50 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm">
                <Zap className="h-5 w-5 text-purple-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900">AI Agent Skills</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Skills are actions your AI can perform during conversations. Enable skills to let your AI look up orders,
                  create support tickets, transfer to humans, and more. Skills requiring integrations must be connected first.
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 text-sm">
                <Badge variant="outline" className="bg-white">
                  {data.summary.enabled} / {data.summary.available} active
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Skills by Category */}
        {data.categories.map((category) => (
          <Card key={category.category} className="border-0 shadow-sm">
            <CardHeader
              className="cursor-pointer select-none py-3"
              onClick={() => toggleCategory(category.category)}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  {expandedCategories.has(category.category) ? (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  )}
                  {category.label}
                  <Badge variant="outline" className="ml-2 font-normal">
                    {category.skills.filter((s) => s.is_enabled).length} / {category.skills.length}
                  </Badge>
                </CardTitle>
              </div>
            </CardHeader>

            {expandedCategories.has(category.category) && (
              <CardContent className="pt-0">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {category.skills.map((skill) => (
                    <SkillCard
                      key={skill.id}
                      skill={skill}
                      onToggle={() => toggleSkill(skill)}
                      isToggling={togglingSkill === skill.id}
                    />
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </TooltipProvider>
  );
}

interface SkillCardProps {
  skill: Skill;
  onToggle: () => void;
  isToggling: boolean;
}

function SkillCard({ skill, onToggle, isToggling }: SkillCardProps) {
  const isDisabled = !skill.is_available;
  const needsConnection = skill.connection_status === "disconnected";

  return (
    <div
      className={`rounded-lg border p-4 transition-all ${
        isDisabled
          ? "border-dashed bg-slate-50 opacity-60"
          : skill.is_enabled
            ? "border-green-200 bg-green-50/50"
            : needsConnection
              ? "border-dashed border-amber-200 bg-amber-50/30"
              : "bg-white hover:border-blue-200 hover:shadow-sm"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${colorMap[skill.icon_color] || colorMap.gray}`}>
            {iconMap[skill.icon_name] || <Zap className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-slate-900">{skill.name}</h4>
              {!skill.is_available && (
                <Badge variant="outline" className="text-xs">
                  Coming Soon
                </Badge>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">
              {skill.description}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* Status indicators */}
          {skill.is_enabled && skill.connection_status !== "disconnected" && (
            <Tooltip>
              <TooltipTrigger>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </TooltipTrigger>
              <TooltipContent>Active</TooltipContent>
            </Tooltip>
          )}

          {needsConnection && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/settings/integrations">
                  <Badge variant="outline" className="cursor-pointer gap-1 text-xs text-amber-600 hover:bg-amber-50">
                    <ExternalLink className="h-3 w-3" />
                    Connect
                  </Badge>
                </Link>
              </TooltipTrigger>
              <TooltipContent>
                Connect {skill.requires_integration} in Integrations
              </TooltipContent>
            </Tooltip>
          )}

          {/* Toggle switch */}
          {skill.is_available && (
            <Switch
              checked={skill.is_enabled}
              onCheckedChange={onToggle}
              disabled={isToggling}
              className="data-[state=checked]:bg-green-500"
            />
          )}
        </div>
      </div>

      {/* Capabilities preview */}
      {skill.capabilities && skill.capabilities.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {skill.capabilities.slice(0, 2).map((cap, i) => (
            <span
              key={i}
              className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
            >
              {cap}
            </span>
          ))}
          {skill.capabilities.length > 2 && (
            <Tooltip>
              <TooltipTrigger>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  +{skill.capabilities.length - 2} more
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <ul className="text-xs">
                  {skill.capabilities.slice(2).map((cap, i) => (
                    <li key={i}>• {cap}</li>
                  ))}
                </ul>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      )}
    </div>
  );
}
