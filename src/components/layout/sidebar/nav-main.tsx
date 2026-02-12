"use client";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Inbox,
  Users,
  ShoppingCart,
  Mail,
  Headphones,
  Bot,
  Settings,
  type LucideIcon
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavGroup = {
  title: string;
  items: NavItem[];
};

type NavItem = {
  title: string;
  href: string;
  icon?: LucideIcon;
};

export const navItems: NavGroup[] = [
  {
    title: "Main",
    items: [
      { title: "Dashboard", href: "/", icon: LayoutDashboard },
      { title: "Inbox", href: "/inbox", icon: Inbox },
      { title: "Customers", href: "/customers", icon: Users },
      { title: "Orders", href: "/orders", icon: ShoppingCart },
    ]
  },
  {
    title: "Marketing",
    items: [
      { title: "Outreach", href: "/outreach", icon: Mail },
    ]
  },
  {
    title: "Support",
    items: [
      { title: "Helpdesk", href: "/helpdesk", icon: Headphones },
      { title: "AI Agent", href: "/ai-agent", icon: Bot },
    ]
  },
  {
    title: "System",
    items: [
      { title: "Settings", href: "/settings", icon: Settings },
    ]
  }
];

export function NavMain() {
  const pathname = usePathname();
  const { isMobile } = useSidebar();

  return (
    <>
      {navItems.map((nav) => (
        <SidebarGroup key={nav.title}>
          <SidebarGroupLabel>{nav.title}</SidebarGroupLabel>
          <SidebarGroupContent className="flex flex-col gap-1">
            <SidebarMenu>
              {nav.items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    className="hover:text-foreground active:text-foreground hover:bg-[var(--primary)]/10 active:bg-[var(--primary)]/10"
                    isActive={pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))}
                    tooltip={item.title}
                    asChild>
                    <Link href={item.href}>
                      {item.icon && <item.icon className="size-4" />}
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}
