"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Inbox,
  Bot,
  Settings,
  HelpCircle,
  LogOut,
  User,
  Users,
  Package,
  Mail,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useAgentOptional } from "@/contexts/AgentContext";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: Inbox, label: "Inbox", href: "/inbox" },
  { icon: Users, label: "Customers", href: "/customers" },
  { icon: Package, label: "Orders", href: "/orders" },
  { icon: Mail, label: "Outreach", href: "/outreach" },
  { icon: Bot, label: "AI Agent", href: "/ai-agent" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export function IconSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const agentContext = useAgentOptional();
  const agent = agentContext?.agent;

  const handleLogout = async () => {
    if (agentContext?.logout) {
      await agentContext.logout();
      router.push("/login");
    }
  };

  const handleToggleOnline = async (checked: boolean) => {
    if (agentContext?.setOnlineStatus) {
      await agentContext.setOnlineStatus(checked);
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

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
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
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

        {/* Bottom Section - Agent Profile & Help */}
        <div className="mt-auto flex flex-col items-center gap-2">
          {/* Help Button */}
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

          {/* Agent Profile */}
          {agent ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-slate-700 text-sm font-medium text-white transition-colors hover:bg-slate-600">
                  {getInitials(agent.name)}
                  {/* Online indicator */}
                  <span
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-900",
                      agent.is_online ? "bg-green-500" : "bg-slate-400"
                    )}
                  />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <span className="font-medium">{agent.name}</span>
                    <span className="text-xs font-normal text-slate-500">
                      {agent.email}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="flex items-center justify-between px-2 py-1.5">
                  <span className="text-sm">Show online</span>
                  <Switch
                    checked={agent.is_online}
                    onCheckedChange={handleToggleOnline}
                    className="scale-75"
                  />
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings/profile" className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer text-red-600 focus:text-red-600"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/login"
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
                >
                  <User className="h-5 w-5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-slate-800 text-white">
                Sign in
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </TooltipProvider>
    </div>
  );
}
