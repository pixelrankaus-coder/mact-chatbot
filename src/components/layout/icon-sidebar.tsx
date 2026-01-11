"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Inbox,
  Bot,
  Settings,
  HelpCircle,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: Inbox, label: "Inbox", href: "/inbox" },
  { icon: Bot, label: "AI Agent", href: "/ai-agent" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export function IconSidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-screen w-16 flex-col items-center border-r bg-slate-900 py-4">
      {/* Logo */}
      <div className="mb-8 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 font-bold text-white">
        M
      </div>

      {/* Navigation */}
      <TooltipProvider delayDuration={0}>
        <nav className="flex flex-1 flex-col items-center gap-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    prefetch={false}
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                      isActive
                        ? "bg-blue-600 text-white"
                        : "text-slate-400 hover:bg-slate-800 hover:text-white"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-slate-800 text-white">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        {/* Bottom Help */}
        <div className="mt-auto">
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white">
                <HelpCircle className="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-slate-800 text-white">
              Help & Support
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  );
}
