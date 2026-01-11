"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ScrollArea } from "@/components/ui/scroll-area";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsNavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  section: string;
}

const settingsNav: SettingsNavItem[] = [
  { id: "live-chat", label: "Live Chat", href: "/settings", icon: <MessageSquare className="h-4 w-4" />, section: "CHANNELS" },
  { id: "appearance", label: "Appearance", href: "/settings/appearance", icon: <Palette className="h-4 w-4" />, section: "CHANNELS" },
  { id: "installation", label: "Installation", href: "/settings/installation", icon: <Code className="h-4 w-4" />, section: "CHANNELS" },
  { id: "chat-page", label: "Chat page", href: "/settings/chat-page", icon: <Globe className="h-4 w-4" />, section: "CHANNELS" },
  { id: "account", label: "Account", href: "/settings/account", icon: <User className="h-4 w-4" />, section: "PERSONAL" },
  { id: "notifications", label: "Notifications", href: "/settings/notifications", icon: <Bell className="h-4 w-4" />, section: "PERSONAL" },
  { id: "operating-hours", label: "Operating hours", href: "/settings/operating-hours", icon: <Clock className="h-4 w-4" />, section: "PERSONAL" },
  { id: "team", label: "Team", href: "/settings/team", icon: <Users className="h-4 w-4" />, section: "GENERAL" },
  { id: "integrations", label: "Integrations", href: "/settings/integrations", icon: <Plug className="h-4 w-4" />, section: "GENERAL" },
];

export function SettingsSidebar() {
  const pathname = usePathname();

  const renderNavSection = (sectionName: string) => {
    const items = settingsNav.filter((item) => item.section === sectionName);
    return (
      <div className="mb-4">
        <p className="mb-2 px-3 text-xs font-semibold uppercase text-slate-400">
          {sectionName}
        </p>
        <div className="space-y-1">
          {items.map((item) => {
            const isActive = pathname === item.href ||
              (item.href === "/settings" && pathname === "/settings") ||
              (item.href !== "/settings" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.id}
                href={item.href}
                prefetch={false}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-blue-50 text-blue-600"
                    : "text-slate-600 hover:bg-slate-50"
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="w-56 border-r bg-white">
      <div className="border-b p-4">
        <h2 className="text-lg font-semibold text-slate-900">Settings</h2>
      </div>
      <ScrollArea className="h-[calc(100vh-130px)]">
        <div className="p-2">
          {renderNavSection("CHANNELS")}
          {renderNavSection("PERSONAL")}
          {renderNavSection("GENERAL")}
        </div>
      </ScrollArea>
    </div>
  );
}
