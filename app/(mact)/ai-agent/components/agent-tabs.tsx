"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sparkles,
  Zap,
  Settings,
  Sliders,
  MessageSquare,
} from "lucide-react";

export type AgentTab = "training" | "skills" | "settings" | "behavior" | "test";

const tabs: { value: AgentTab; label: string; icon: React.ReactNode }[] = [
  { value: "training", label: "Training", icon: <Sparkles className="h-4 w-4" /> },
  { value: "skills", label: "Skills", icon: <Zap className="h-4 w-4" /> },
  { value: "settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
  { value: "behavior", label: "Behavior", icon: <Sliders className="h-4 w-4" /> },
  { value: "test", label: "Test", icon: <MessageSquare className="h-4 w-4" /> },
];

interface AgentTabsProps {
  defaultTab?: AgentTab;
}

export function AgentTabs({ defaultTab = "training" }: AgentTabsProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const currentTab = (searchParams.get("tab") as AgentTab) || defaultTab;

  const handleTabChange = (tab: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
      <TabsList className="w-full justify-start gap-1 bg-transparent p-0">
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className="flex items-center gap-2 rounded-lg px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            {tab.icon}
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

export function useAgentTab(defaultTab: AgentTab = "training"): AgentTab {
  const searchParams = useSearchParams();
  return (searchParams.get("tab") as AgentTab) || defaultTab;
}
