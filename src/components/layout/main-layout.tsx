"use client";

import { usePathname } from "next/navigation";
import { IconSidebar } from "./icon-sidebar";

interface MainLayoutProps {
  children: React.ReactNode;
}

const AUTH_ROUTES = ["/login", "/forgot-password", "/reset-password"];

export function MainLayout({ children }: MainLayoutProps) {
  const pathname = usePathname();
  const isAuthPage = AUTH_ROUTES.some((route) => pathname?.startsWith(route));

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <IconSidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
