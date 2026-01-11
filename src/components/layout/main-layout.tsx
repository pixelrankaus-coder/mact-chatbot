"use client";

import { IconSidebar } from "./icon-sidebar";

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="flex h-screen bg-slate-50">
      <IconSidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
