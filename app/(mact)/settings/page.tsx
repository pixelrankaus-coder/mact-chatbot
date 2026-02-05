"use client";

import Link from "next/link";
import {
  MessageSquare,
  Palette,
  Code,
  Globe,
  User,
  Bell,
  Clock,
  Users,
  Plug,
  History,
  Cpu,
  ClipboardList,
  UserCog,
  ChevronRight,
  Settings,
} from "lucide-react";
import { ADMIN_VERSION, WIDGET_VERSION } from "@/lib/version";

interface SettingsCard {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  iconBg: string;
}

interface SettingsSection {
  title: string;
  cards: SettingsCard[];
}

const settingsSections: SettingsSection[] = [
  {
    title: "Channels",
    cards: [
      {
        id: "live-chat",
        label: "Live Chat",
        description: "Configure chat behavior and assignment rules",
        href: "/settings/live-chat",
        icon: <MessageSquare className="h-5 w-5" />,
        iconBg: "bg-blue-100 text-blue-600",
      },
      {
        id: "prechat",
        label: "Pre-chat Form",
        description: "Customize the form shown before chat starts",
        href: "/settings/prechat",
        icon: <ClipboardList className="h-5 w-5" />,
        iconBg: "bg-violet-100 text-violet-600",
      },
      {
        id: "appearance",
        label: "Appearance",
        description: "Customize colors, branding, and widget style",
        href: "/settings/appearance",
        icon: <Palette className="h-5 w-5" />,
        iconBg: "bg-pink-100 text-pink-600",
      },
      {
        id: "installation",
        label: "Installation",
        description: "Get the code to add chat to your website",
        href: "/settings/installation",
        icon: <Code className="h-5 w-5" />,
        iconBg: "bg-slate-100 text-slate-600",
      },
      {
        id: "chat-page",
        label: "Chat Page",
        description: "Configure your standalone chat page",
        href: "/settings/chat-page",
        icon: <Globe className="h-5 w-5" />,
        iconBg: "bg-emerald-100 text-emerald-600",
      },
      {
        id: "ai-provider",
        label: "AI Provider",
        description: "Configure AI models and response settings",
        href: "/settings/ai-provider",
        icon: <Cpu className="h-5 w-5" />,
        iconBg: "bg-amber-100 text-amber-600",
      },
    ],
  },
  {
    title: "Personal",
    cards: [
      {
        id: "account",
        label: "Account",
        description: "Manage your profile and login settings",
        href: "/settings/account",
        icon: <User className="h-5 w-5" />,
        iconBg: "bg-indigo-100 text-indigo-600",
      },
      {
        id: "notifications",
        label: "Notifications",
        description: "Configure email and push notification preferences",
        href: "/settings/notifications",
        icon: <Bell className="h-5 w-5" />,
        iconBg: "bg-orange-100 text-orange-600",
      },
      {
        id: "operating-hours",
        label: "Operating Hours",
        description: "Set your team's availability schedule",
        href: "/settings/operating-hours",
        icon: <Clock className="h-5 w-5" />,
        iconBg: "bg-cyan-100 text-cyan-600",
      },
    ],
  },
  {
    title: "General",
    cards: [
      {
        id: "team",
        label: "Team",
        description: "Manage team members and permissions",
        href: "/settings/team",
        icon: <Users className="h-5 w-5" />,
        iconBg: "bg-green-100 text-green-600",
      },
      {
        id: "customers",
        label: "Customer Segments",
        description: "Define customer groups for targeting",
        href: "/settings/customers",
        icon: <UserCog className="h-5 w-5" />,
        iconBg: "bg-rose-100 text-rose-600",
      },
      {
        id: "integrations",
        label: "Integrations",
        description: "Connect with third-party services",
        href: "/settings/integrations",
        icon: <Plug className="h-5 w-5" />,
        iconBg: "bg-purple-100 text-purple-600",
      },
      {
        id: "changelog",
        label: "Changelog",
        description: "View recent updates and changes",
        href: "/settings/changelog",
        icon: <History className="h-5 w-5" />,
        iconBg: "bg-slate-100 text-slate-600",
      },
    ],
  },
];

export default function SettingsHub() {
  return (
    <div className="flex-1 overflow-auto bg-slate-50">
      <div className="p-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900">
            <Settings className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h1>
            <p className="text-sm text-slate-500">
              Manage your workspace preferences and configurations
            </p>
          </div>
        </div>

        {/* Settings Sections */}
        <div className="space-y-8">
          {settingsSections.map((section) => (
            <div key={section.title}>
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                {section.title}
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {section.cards.map((card) => (
                  <Link
                    key={card.id}
                    href={card.href}
                    className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between">
                      <div className={`rounded-lg p-2.5 ${card.iconBg}`}>
                        {card.icon}
                      </div>
                      <ChevronRight className="h-5 w-5 text-slate-300 transition-colors group-hover:text-slate-500" />
                    </div>
                    <div className="mt-4">
                      <h3 className="font-semibold text-slate-900">{card.label}</h3>
                      <p className="mt-1 text-sm text-slate-500">{card.description}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Version Footer */}
        <div className="mt-8 border-t border-slate-200 pt-4">
          <p className="text-xs text-slate-400">
            Admin v{ADMIN_VERSION} &middot; Widget v{WIDGET_VERSION}
          </p>
        </div>
      </div>
    </div>
  );
}
