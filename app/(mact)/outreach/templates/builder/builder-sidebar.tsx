"use client";

import React from "react";
import type { BlockType } from "@/lib/email-builder/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Type,
  Image,
  Columns3,
  MousePointerClick,
  PanelTop,
  Eclipse,
  Minus,
  Heart,
  ArrowUpDown,
  ShoppingBag,
  Ticket,
  LayoutGrid,
  MessageSquareQuote,
  Video,
  Code,
  LayoutTemplate,
  Rows3,
  PanelBottom,
  GripVertical,
} from "lucide-react";

interface BlockDef {
  id: BlockType;
  label: string;
  icon: React.ElementType;
  isNew?: boolean;
}

const CONTENT_BLOCKS: BlockDef[] = [
  { id: "text", label: "Text", icon: Type },
  { id: "image", label: "Image", icon: Image },
  { id: "button", label: "Button", icon: MousePointerClick },
  { id: "header", label: "Header bar", icon: PanelTop },
  { id: "hero", label: "Hero", icon: Eclipse },
  { id: "divider", label: "Divider", icon: Minus },
  { id: "social", label: "Social links", icon: Heart },
  { id: "spacer", label: "Spacer", icon: ArrowUpDown },
  { id: "product", label: "Product", icon: ShoppingBag },
  { id: "coupon", label: "Coupon", icon: Ticket, isNew: true },
  { id: "quote", label: "Review quote", icon: MessageSquareQuote },
  { id: "video", label: "Video", icon: Video },
  { id: "html", label: "HTML", icon: Code },
];

const LAYOUT_BLOCKS: BlockDef[] = [
  { id: "columns", label: "Columns", icon: Columns3 },
  { id: "footer", label: "Footer", icon: PanelBottom },
];

function BlockCard({ def, onClick }: { def: BlockDef; onClick: () => void }) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/block-type", def.id);
        e.dataTransfer.effectAllowed = "copy";
      }}
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1.5 p-3 border rounded-lg cursor-grab hover:bg-slate-50 hover:border-slate-300 transition-colors group relative active:cursor-grabbing select-none"
    >
      <GripVertical className="h-3 w-3 text-slate-300 absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity" />
      <def.icon className="h-5 w-5 text-slate-500" />
      <span className="text-[11px] text-slate-600 font-medium leading-tight text-center">
        {def.label}
      </span>
      {def.isNew && (
        <span className="absolute -top-1.5 -right-1.5 text-[9px] font-bold text-orange-600 bg-orange-50 border border-orange-200 rounded px-1">
          New
        </span>
      )}
    </div>
  );
}

interface BuilderSidebarProps {
  onAddBlock: (type: BlockType) => void;
}

export function BuilderSidebar({ onAddBlock }: BuilderSidebarProps) {
  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-5">
        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Blocks
          </div>
          <div className="grid grid-cols-3 gap-2">
            {CONTENT_BLOCKS.map((def) => (
              <BlockCard
                key={def.id}
                def={def}
                onClick={() => onAddBlock(def.id)}
              />
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Layout
          </div>
          <div className="grid grid-cols-3 gap-2">
            {LAYOUT_BLOCKS.map((def) => (
              <BlockCard
                key={def.id}
                def={def}
                onClick={() => onAddBlock(def.id)}
              />
            ))}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
