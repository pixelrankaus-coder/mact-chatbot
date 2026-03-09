"use client";

import React, { useRef, useState } from "react";
import type {
  EmailBlock,
  EmailDesign,
  BlockType,
  Padding,
  TextBlockProps,
  ImageBlockProps,
  ButtonBlockProps,
  ColumnsBlockProps,
  SectionBlockProps,
  DividerBlockProps,
  SpacerBlockProps,
  SocialBlockProps,
  HeaderBlockProps,
  FooterBlockProps,
  HeroBlockProps,
  ProductBlockProps,
  CouponBlockProps,
  VideoBlockProps,
  HtmlBlockProps,
  QuoteBlockProps,
  SocialLink,
  Alignment,
} from "@/lib/email-builder/types";
import { MERGE_TAGS } from "@/lib/email-builder/types";
import { uid } from "@/lib/email-builder/defaults";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Plus,
  Trash2,
  Tag,
  Upload,
  Loader2,
  ImageIcon,
  GripVertical,
  ChevronDown,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// ─── Shared Controls ─────────────────────────────────────────────────────────

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Label className="text-xs text-muted-foreground w-24 shrink-0">
        {label}
      </Label>
      <div className="flex items-center gap-1.5 flex-1">
        <input
          type="color"
          value={value || "#ffffff"}
          onChange={(e) => onChange(e.target.value)}
          className="w-7 h-7 rounded border cursor-pointer"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#hex or empty"
          className="h-7 text-xs flex-1"
        />
      </div>
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  min = 0,
  max = 999,
  unit = "px",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  unit?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Label className="text-xs text-muted-foreground w-24 shrink-0">
        {label}
      </Label>
      <div className="flex items-center gap-1 flex-1">
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value))))}
          className="h-7 text-xs"
          min={min}
          max={max}
        />
        <span className="text-[10px] text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}

function PaddingInput({
  value,
  onChange,
}: {
  value: Padding;
  onChange: (v: Padding) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">Padding</Label>
      <div className="grid grid-cols-4 gap-1">
        {(["top", "right", "bottom", "left"] as const).map((side) => (
          <div key={side}>
            <Input
              type="number"
              value={value[side]}
              onChange={(e) =>
                onChange({ ...value, [side]: Math.max(0, Number(e.target.value)) })
              }
              className="h-7 text-xs text-center"
              min={0}
              placeholder={side[0].toUpperCase()}
            />
            <div className="text-[9px] text-muted-foreground text-center mt-0.5">
              {side[0].toUpperCase()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AlignmentInput({
  value,
  onChange,
}: {
  value: Alignment;
  onChange: (v: Alignment) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Label className="text-xs text-muted-foreground w-24 shrink-0">
        Align
      </Label>
      <div className="flex gap-0.5">
        {(
          [
            { v: "left", icon: AlignLeft },
            { v: "center", icon: AlignCenter },
            { v: "right", icon: AlignRight },
          ] as const
        ).map(({ v, icon: Icon }) => (
          <Button
            key={v}
            variant={value === v ? "default" : "outline"}
            size="icon"
            className="h-7 w-7"
            onClick={() => onChange(v)}
          >
            <Icon className="h-3.5 w-3.5" />
          </Button>
        ))}
      </div>
    </div>
  );
}

function MergeTagButton({ onInsert }: { onInsert: (tag: string) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
          <Tag className="h-3 w-3" />
          Merge tag
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        <ScrollArea className="max-h-[240px]">
          {MERGE_TAGS.map((tag) => (
            <button
              key={tag.value}
              onClick={() => onInsert(tag.value)}
              className="w-full text-left px-2 py-1.5 text-xs hover:bg-slate-100 rounded"
            >
              <span className="font-medium">{tag.label}</span>
              <span className="text-muted-foreground ml-1">{tag.value}</span>
            </button>
          ))}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <>
      <Separator />
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-1">
        {title}
      </div>
    </>
  );
}

// ─── Image Upload Component ─────────────────────────────────────────────────

/** Compress image client-side to stay under Vercel's 4.5MB body limit */
function compressImage(file: File, maxWidth = 1200, quality = 0.85): Promise<File> {
  return new Promise((resolve) => {
    // Skip SVGs and small files
    if (file.type === "image/svg+xml" || file.size < 500_000) {
      resolve(file);
      return;
    }
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob && blob.size < file.size) {
            resolve(new File([blob], file.name, { type: "image/jpeg" }));
          } else {
            resolve(file); // Original was smaller, keep it
          }
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

function ImageUpload({
  value,
  onChange,
  label = "Image",
}: {
  value: string;
  onChange: (url: string) => void;
  label?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const compressed = await compressImage(file);
      const formData = new FormData();
      formData.append("file", compressed);
      const res = await fetch("/api/outreach/upload", {
        method: "POST",
        body: formData,
      });
      if (res.status === 413) {
        setError("Image too large. Try a smaller file (under 4MB).");
        return;
      }
      const data = await res.json();
      if (res.ok && data.url) {
        onChange(data.url);
      } else {
        setError(data.error || "Upload failed");
      }
    } catch (err) {
      console.error("Upload error:", err);
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {value ? (
        <div className="relative group">
          <img
            src={value}
            alt="Preview"
            className="w-full rounded border object-cover"
            style={{ maxHeight: 160 }}
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="h-7 text-xs"
              onClick={() => fileRef.current?.click()}
            >
              Replace
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onChange("")}
            >
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => !uploading && fileRef.current?.click()}
          className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center cursor-pointer hover:border-slate-300 hover:bg-slate-50 transition-colors"
        >
          {uploading ? (
            <Loader2 className="h-8 w-8 animate-spin text-slate-400 mx-auto" />
          ) : (
            <>
              <ImageIcon className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-medium text-slate-500">
                Click to upload image
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                PNG, JPG, GIF, WebP up to 5MB
              </p>
            </>
          )}
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
          e.target.value = "";
        }}
      />
      {error && (
        <p className="text-xs text-red-500 font-medium">{error}</p>
      )}
      <div className="flex items-center gap-1">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Or paste image URL..."
          className="h-7 text-xs flex-1"
        />
      </div>
    </div>
  );
}

// ─── Panel Per Block Type ────────────────────────────────────────────────────

function TextPanel({
  props: p,
  onUpdate,
}: {
  props: TextBlockProps;
  onUpdate: (partial: Partial<TextBlockProps>) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs text-muted-foreground">Content</Label>
        <textarea
          value={p.content}
          onChange={(e) => onUpdate({ content: e.target.value })}
          className="w-full mt-1 text-xs border rounded p-2 min-h-[80px] resize-y"
          placeholder="HTML content..."
        />
        <MergeTagButton
          onInsert={(tag) => onUpdate({ content: p.content + tag })}
        />
      </div>
      <NumberInput label="Font size" value={p.fontSize} onChange={(v) => onUpdate({ fontSize: v })} min={10} max={72} />
      <NumberInput label="Line height" value={p.lineHeight} onChange={(v) => onUpdate({ lineHeight: v })} min={1} max={3} unit="×" />
      <ColorInput label="Text color" value={p.color} onChange={(v) => onUpdate({ color: v })} />
      <ColorInput label="Background" value={p.backgroundColor} onChange={(v) => onUpdate({ backgroundColor: v })} />
      <AlignmentInput value={p.alignment} onChange={(v) => onUpdate({ alignment: v })} />
      <PaddingInput value={p.padding} onChange={(v) => onUpdate({ padding: v })} />
    </div>
  );
}

function ImagePanel({
  props: p,
  onUpdate,
}: {
  props: ImageBlockProps;
  onUpdate: (partial: Partial<ImageBlockProps>) => void;
}) {
  return (
    <div className="space-y-3">
      <ImageUpload
        value={p.src}
        onChange={(url) => onUpdate({ src: url })}
      />
      <SectionHeader title="Settings" />
      <div>
        <Label className="text-xs text-muted-foreground">Link URL</Label>
        <Input
          value={p.href}
          onChange={(e) => onUpdate({ href: e.target.value })}
          placeholder="https://..."
          className="h-7 text-xs mt-1"
        />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Alt text</Label>
        <Input
          value={p.alt}
          onChange={(e) => onUpdate({ alt: e.target.value })}
          className="h-7 text-xs mt-1"
        />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Width</Label>
        <Select
          value={String(p.width)}
          onValueChange={(v) => onUpdate({ width: v === "full" ? "full" : Number(v) })}
        >
          <SelectTrigger className="h-7 text-xs mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="full">Full width</SelectItem>
            <SelectItem value="400">400px</SelectItem>
            <SelectItem value="300">300px</SelectItem>
            <SelectItem value="200">200px</SelectItem>
            <SelectItem value="150">150px</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <AlignmentInput value={p.alignment} onChange={(v) => onUpdate({ alignment: v })} />
      <NumberInput label="Border radius" value={p.border.radius} onChange={(v) => onUpdate({ border: { ...p.border, radius: v } })} />
      <ColorInput label="Background" value={p.backgroundColor} onChange={(v) => onUpdate({ backgroundColor: v })} />
      <PaddingInput value={p.padding} onChange={(v) => onUpdate({ padding: v })} />
    </div>
  );
}

function ButtonPanel({
  props: p,
  onUpdate,
}: {
  props: ButtonBlockProps;
  onUpdate: (partial: Partial<ButtonBlockProps>) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs text-muted-foreground">Button text</Label>
        <Input
          value={p.text}
          onChange={(e) => onUpdate({ text: e.target.value })}
          className="h-7 text-xs mt-1"
        />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Link URL</Label>
        <Input
          value={p.href}
          onChange={(e) => onUpdate({ href: e.target.value })}
          placeholder="https://..."
          className="h-7 text-xs mt-1"
        />
      </div>
      <NumberInput label="Font size" value={p.fontSize} onChange={(v) => onUpdate({ fontSize: v })} min={10} max={36} />
      <ColorInput label="Text color" value={p.color} onChange={(v) => onUpdate({ color: v })} />
      <ColorInput label="Btn color" value={p.backgroundColor} onChange={(v) => onUpdate({ backgroundColor: v })} />
      <NumberInput label="Radius" value={p.borderRadius} onChange={(v) => onUpdate({ borderRadius: v })} />
      <AlignmentInput value={p.alignment} onChange={(v) => onUpdate({ alignment: v })} />
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground w-24 shrink-0">Full width</Label>
        <input
          type="checkbox"
          checked={p.fullWidth}
          onChange={(e) => onUpdate({ fullWidth: e.target.checked })}
          className="rounded"
        />
      </div>
      <SectionHeader title="Button Padding" />
      <PaddingInput value={p.padding} onChange={(v) => onUpdate({ padding: v })} />
      <SectionHeader title="Container" />
      <ColorInput label="Container bg" value={p.containerBackgroundColor} onChange={(v) => onUpdate({ containerBackgroundColor: v })} />
      <PaddingInput value={p.containerPadding} onChange={(v) => onUpdate({ containerPadding: v })} />
    </div>
  );
}

function ColumnsPanel({
  props: p,
  onUpdate,
}: {
  props: ColumnsBlockProps;
  onUpdate: (partial: Partial<ColumnsBlockProps>) => void;
}) {
  const setColumnWidth = (idx: number, width: number) => {
    const cols = [...p.columns];
    cols[idx] = { ...cols[idx], width };
    onUpdate({ columns: cols });
  };

  const addColumn = () => {
    const newWidth = Math.round(100 / (p.columns.length + 1));
    const cols = p.columns.map((c) => ({ ...c, width: newWidth }));
    cols.push({ id: uid(), width: newWidth, blocks: [] });
    const total = cols.reduce((s, c) => s + c.width, 0);
    if (total !== 100) cols[cols.length - 1].width += 100 - total;
    onUpdate({ columns: cols });
  };

  const removeColumn = (idx: number) => {
    if (p.columns.length <= 1) return;
    const cols = p.columns.filter((_, i) => i !== idx);
    const each = Math.round(100 / cols.length);
    cols.forEach((c, i) => (c.width = i === cols.length - 1 ? 100 - each * (cols.length - 1) : each));
    onUpdate({ columns: cols });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">
          Columns ({p.columns.length})
        </Label>
        <Button variant="outline" size="sm" className="h-6 text-xs" onClick={addColumn}>
          <Plus className="h-3 w-3 mr-1" />
          Add
        </Button>
      </div>
      {p.columns.map((col, i) => (
        <div key={col.id} className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-12">Col {i + 1}</span>
          <Input
            type="number"
            value={col.width}
            onChange={(e) => setColumnWidth(i, Number(e.target.value))}
            className="h-7 text-xs w-16"
            min={10}
            max={90}
          />
          <span className="text-xs text-muted-foreground">%</span>
          {p.columns.length > 1 && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeColumn(i)}>
              <Trash2 className="h-3 w-3 text-red-500" />
            </Button>
          )}
        </div>
      ))}
      <NumberInput label="Gap" value={p.gap} onChange={(v) => onUpdate({ gap: v })} />
      <ColorInput label="Background" value={p.backgroundColor} onChange={(v) => onUpdate({ backgroundColor: v })} />
      <PaddingInput value={p.padding} onChange={(v) => onUpdate({ padding: v })} />
    </div>
  );
}

function SectionPanel({
  props: p,
  onUpdate,
}: {
  props: SectionBlockProps;
  onUpdate: (partial: Partial<SectionBlockProps>) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Drag blocks into this section from the sidebar. Sections group content with a shared background.
      </p>
      <ColorInput label="Background" value={p.backgroundColor} onChange={(v) => onUpdate({ backgroundColor: v })} />
      <PaddingInput value={p.padding} onChange={(v) => onUpdate({ padding: v })} />
      <SectionHeader title="Borders" />
      <NumberInput label="Top border" value={p.borderTop.width} onChange={(v) => onUpdate({ borderTop: { ...p.borderTop, width: v } })} max={10} />
      <ColorInput label="Top color" value={p.borderTop.color} onChange={(v) => onUpdate({ borderTop: { ...p.borderTop, color: v } })} />
      <NumberInput label="Bottom border" value={p.borderBottom.width} onChange={(v) => onUpdate({ borderBottom: { ...p.borderBottom, width: v } })} max={10} />
      <ColorInput label="Bottom color" value={p.borderBottom.color} onChange={(v) => onUpdate({ borderBottom: { ...p.borderBottom, color: v } })} />
    </div>
  );
}

function DividerPanel({
  props: p,
  onUpdate,
}: {
  props: DividerBlockProps;
  onUpdate: (partial: Partial<DividerBlockProps>) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground w-24 shrink-0">Style</Label>
        <Select value={p.style} onValueChange={(v: "solid" | "dashed" | "dotted") => onUpdate({ style: v })}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="solid">Solid</SelectItem>
            <SelectItem value="dashed">Dashed</SelectItem>
            <SelectItem value="dotted">Dotted</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <ColorInput label="Color" value={p.color} onChange={(v) => onUpdate({ color: v })} />
      <NumberInput label="Thickness" value={p.thickness} onChange={(v) => onUpdate({ thickness: v })} min={1} max={10} />
      <NumberInput label="Width" value={p.width} onChange={(v) => onUpdate({ width: v })} min={10} max={100} unit="%" />
      <ColorInput label="Background" value={p.backgroundColor} onChange={(v) => onUpdate({ backgroundColor: v })} />
      <PaddingInput value={p.padding} onChange={(v) => onUpdate({ padding: v })} />
    </div>
  );
}

function SpacerPanel({
  props: p,
  onUpdate,
}: {
  props: SpacerBlockProps;
  onUpdate: (partial: Partial<SpacerBlockProps>) => void;
}) {
  return (
    <div className="space-y-3">
      <NumberInput label="Height" value={p.height} onChange={(v) => onUpdate({ height: v })} min={4} max={200} />
      <ColorInput label="Background" value={p.backgroundColor} onChange={(v) => onUpdate({ backgroundColor: v })} />
    </div>
  );
}

const SOCIAL_PLATFORMS: { value: SocialLink["platform"]; label: string }[] = [
  { value: "custom", label: "Custom" },
  { value: "facebook", label: "Facebook" },
  { value: "youtube", label: "YouTube" },
  { value: "instagram", label: "Instagram" },
  { value: "twitter", label: "Twitter" },
  { value: "x", label: "X" },
  { value: "tiktok", label: "TikTok" },
  { value: "snapchat", label: "Snapchat" },
  { value: "pinterest", label: "Pinterest" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "android", label: "Android" },
  { value: "website", label: "Website" },
];

function SocialLinkAccordion({
  link,
  index,
  expanded,
  onToggle,
  onChange,
  onDelete,
}: {
  link: SocialLink;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onChange: (partial: Partial<SocialLink>) => void;
  onDelete: () => void;
}) {
  const platformLabel = SOCIAL_PLATFORMS.find((pl) => pl.value === link.platform)?.label || link.platform;

  return (
    <div className="border rounded-lg overflow-hidden">
      <div
        className="flex items-center gap-2 px-3 py-2.5 bg-white cursor-pointer hover:bg-slate-50"
        onClick={onToggle}
      >
        <GripVertical className="h-3.5 w-3.5 text-slate-300 shrink-0 cursor-grab" />
        <ChevronDown className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
        <span className="text-sm font-medium text-slate-700 flex-1 truncate">
          {link.label || platformLabel}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
        >
          <Trash2 className="h-3.5 w-3.5 text-slate-400 hover:text-red-500" />
        </Button>
      </div>
      {expanded && (
        <div className="px-3 pb-3 space-y-2.5 border-t bg-slate-50/50">
          <div className="pt-2.5">
            <Label className="text-xs text-muted-foreground">Platform</Label>
            <Select
              value={link.platform}
              onValueChange={(v) => onChange({ platform: v as SocialLink["platform"] })}
            >
              <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SOCIAL_PLATFORMS.map((pl) => (
                  <SelectItem key={pl.value} value={pl.value}>{pl.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">URL</Label>
            <Input
              value={link.url}
              onChange={(e) => onChange({ url: e.target.value })}
              className="h-8 text-xs mt-1"
              placeholder="https://..."
            />
          </div>
          {link.platform === "custom" && (
            <>
              <div>
                <Label className="text-xs text-muted-foreground">Label</Label>
                <Input
                  value={link.label || ""}
                  onChange={(e) => onChange({ label: e.target.value })}
                  className="h-8 text-xs mt-1"
                  placeholder="Icon label"
                />
              </div>
              <ImageUpload
                value={link.customIconUrl || ""}
                onChange={(url) => onChange({ customIconUrl: url })}
                label="Custom Icon"
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SocialPanel({
  props: p,
  onUpdate,
}: {
  props: SocialBlockProps;
  onUpdate: (partial: Partial<SocialBlockProps>) => void;
}) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const updateLink = (idx: number, partial: Partial<SocialLink>) => {
    const links = p.links.map((l, i) => (i === idx ? { ...l, ...partial } : l));
    onUpdate({ links });
  };

  return (
    <div className="space-y-4">
      {/* Social link accordions */}
      <div className="space-y-2">
        {p.links.map((link, i) => (
          <SocialLinkAccordion
            key={i}
            link={link}
            index={i}
            expanded={expandedIdx === i}
            onToggle={() => setExpandedIdx(expandedIdx === i ? null : i)}
            onChange={(partial) => updateLink(i, partial)}
            onDelete={() => {
              onUpdate({ links: p.links.filter((_, j) => j !== i) });
              if (expandedIdx === i) setExpandedIdx(null);
            }}
          />
        ))}
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => {
            onUpdate({
              links: [...p.links, { platform: "website", url: "https://" }],
            });
            setExpandedIdx(p.links.length);
          }}
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Icon
        </Button>
      </div>

      <Separator />

      {/* Icon styles section */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-slate-700">Icon styles</div>
        <div className="flex gap-2">
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground">Size</Label>
            <Select
              value={p.iconSize <= 24 ? "small" : p.iconSize <= 32 ? "medium" : "large"}
              onValueChange={(v) => onUpdate({ iconSize: v === "small" ? 24 : v === "medium" ? 32 : 48 })}
            >
              <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Small</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="large">Large</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground">Style</Label>
            <Select
              value={p.iconStyle || "color"}
              onValueChange={(v) => onUpdate({ iconStyle: v as SocialBlockProps["iconStyle"] })}
            >
              <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="color">Icon default</SelectItem>
                <SelectItem value="black">Black</SelectItem>
                <SelectItem value="grey">Grey</SelectItem>
                <SelectItem value="white">White</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <AlignmentInput value={p.alignment} onChange={(v) => onUpdate({ alignment: v })} />
        <NumberInput label="Spacing" value={p.spacing ?? 10} onChange={(v) => onUpdate({ spacing: v })} min={0} max={40} />
      </div>

      <Separator />
      <ColorInput label="Background" value={p.backgroundColor} onChange={(v) => onUpdate({ backgroundColor: v })} />
      <PaddingInput value={p.padding} onChange={(v) => onUpdate({ padding: v })} />
    </div>
  );
}

function HeaderPanel({
  props: p,
  onUpdate,
}: {
  props: HeaderBlockProps;
  onUpdate: (partial: Partial<HeaderBlockProps>) => void;
}) {
  return (
    <div className="space-y-3">
      <ImageUpload
        value={p.logoSrc}
        onChange={(url) => onUpdate({ logoSrc: url })}
        label="Logo Image"
      />
      <NumberInput label="Logo width" value={p.logoWidth} onChange={(v) => onUpdate({ logoWidth: v })} min={50} max={400} />
      <div>
        <Label className="text-xs text-muted-foreground">Logo link</Label>
        <Input
          value={p.logoHref}
          onChange={(e) => onUpdate({ logoHref: e.target.value })}
          placeholder="https://..."
          className="h-7 text-xs mt-1"
        />
      </div>
      <AlignmentInput value={p.alignment} onChange={(v) => onUpdate({ alignment: v })} />
      <ColorInput label="Background" value={p.backgroundColor} onChange={(v) => onUpdate({ backgroundColor: v })} />
      <PaddingInput value={p.padding} onChange={(v) => onUpdate({ padding: v })} />
    </div>
  );
}

function FooterPanel({
  props: p,
  onUpdate,
}: {
  props: FooterBlockProps;
  onUpdate: (partial: Partial<FooterBlockProps>) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs text-muted-foreground">Content</Label>
        <textarea
          value={p.content}
          onChange={(e) => onUpdate({ content: e.target.value })}
          className="w-full mt-1 text-xs border rounded p-2 min-h-[80px] resize-y"
        />
        <MergeTagButton
          onInsert={(tag) => onUpdate({ content: p.content + tag })}
        />
      </div>
      <NumberInput label="Font size" value={p.fontSize} onChange={(v) => onUpdate({ fontSize: v })} min={8} max={24} />
      <ColorInput label="Text color" value={p.color} onChange={(v) => onUpdate({ color: v })} />
      <ColorInput label="Background" value={p.backgroundColor} onChange={(v) => onUpdate({ backgroundColor: v })} />
      <AlignmentInput value={p.alignment} onChange={(v) => onUpdate({ alignment: v })} />
      <PaddingInput value={p.padding} onChange={(v) => onUpdate({ padding: v })} />
    </div>
  );
}

function HeroPanel({
  props: p,
  onUpdate,
}: {
  props: HeroBlockProps;
  onUpdate: (partial: Partial<HeroBlockProps>) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs text-muted-foreground">Heading</Label>
        <Input value={p.heading} onChange={(e) => onUpdate({ heading: e.target.value })} className="h-7 text-xs mt-1" />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Subheading</Label>
        <Input value={p.subheading} onChange={(e) => onUpdate({ subheading: e.target.value })} className="h-7 text-xs mt-1" />
      </div>
      <ImageUpload
        value={p.imageSrc}
        onChange={(url) => onUpdate({ imageSrc: url })}
        label="Hero Image"
      />
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground w-24 shrink-0">Image pos</Label>
        <Select value={p.imagePosition} onValueChange={(v: "above" | "below" | "background") => onUpdate({ imagePosition: v })}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="above">Above text</SelectItem>
            <SelectItem value="below">Below text</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <SectionHeader title="Button" />
      <div>
        <Label className="text-xs text-muted-foreground">Button text</Label>
        <Input value={p.buttonText} onChange={(e) => onUpdate({ buttonText: e.target.value })} className="h-7 text-xs mt-1" />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Button URL</Label>
        <Input value={p.buttonHref} onChange={(e) => onUpdate({ buttonHref: e.target.value })} className="h-7 text-xs mt-1" />
      </div>
      <ColorInput label="Btn color" value={p.buttonColor} onChange={(v) => onUpdate({ buttonColor: v })} />
      <ColorInput label="Btn text" value={p.buttonTextColor} onChange={(v) => onUpdate({ buttonTextColor: v })} />
      <SectionHeader title="Colors" />
      <ColorInput label="Heading" value={p.headingColor} onChange={(v) => onUpdate({ headingColor: v })} />
      <ColorInput label="Subheading" value={p.subheadingColor} onChange={(v) => onUpdate({ subheadingColor: v })} />
      <ColorInput label="Background" value={p.backgroundColor} onChange={(v) => onUpdate({ backgroundColor: v })} />
      <AlignmentInput value={p.alignment} onChange={(v) => onUpdate({ alignment: v })} />
      <PaddingInput value={p.padding} onChange={(v) => onUpdate({ padding: v })} />
    </div>
  );
}

function ProductPanel({
  props: p,
  onUpdate,
}: {
  props: ProductBlockProps;
  onUpdate: (partial: Partial<ProductBlockProps>) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs text-muted-foreground">Product name</Label>
        <Input value={p.name} onChange={(e) => onUpdate({ name: e.target.value })} className="h-7 text-xs mt-1" />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Description</Label>
        <textarea value={p.description} onChange={(e) => onUpdate({ description: e.target.value })} className="w-full mt-1 text-xs border rounded p-2 min-h-[50px] resize-y" />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Price</Label>
        <Input value={p.price} onChange={(e) => onUpdate({ price: e.target.value })} className="h-7 text-xs mt-1" />
      </div>
      <ImageUpload
        value={p.imageSrc}
        onChange={(url) => onUpdate({ imageSrc: url })}
        label="Product Image"
      />
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground w-24 shrink-0">Image pos</Label>
        <Select value={p.imagePosition} onValueChange={(v: "left" | "right" | "top") => onUpdate({ imagePosition: v })}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="top">Top</SelectItem>
            <SelectItem value="left">Left</SelectItem>
            <SelectItem value="right">Right</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <SectionHeader title="Button" />
      <Input value={p.buttonText} onChange={(e) => onUpdate({ buttonText: e.target.value })} className="h-7 text-xs" placeholder="Button text" />
      <Input value={p.buttonHref} onChange={(e) => onUpdate({ buttonHref: e.target.value })} className="h-7 text-xs" placeholder="Button URL" />
      <ColorInput label="Btn color" value={p.buttonColor} onChange={(v) => onUpdate({ buttonColor: v })} />
      <ColorInput label="Btn text" value={p.buttonTextColor} onChange={(v) => onUpdate({ buttonTextColor: v })} />
      <ColorInput label="Background" value={p.backgroundColor} onChange={(v) => onUpdate({ backgroundColor: v })} />
      <PaddingInput value={p.padding} onChange={(v) => onUpdate({ padding: v })} />
    </div>
  );
}

function CouponPanel({
  props: p,
  onUpdate,
}: {
  props: CouponBlockProps;
  onUpdate: (partial: Partial<CouponBlockProps>) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs text-muted-foreground">Coupon code</Label>
        <Input value={p.code} onChange={(e) => onUpdate({ code: e.target.value })} className="h-7 text-xs mt-1" />
        <MergeTagButton onInsert={(tag) => onUpdate({ code: tag })} />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Description</Label>
        <Input value={p.description} onChange={(e) => onUpdate({ description: e.target.value })} className="h-7 text-xs mt-1" />
      </div>
      <NumberInput label="Font size" value={p.fontSize} onChange={(v) => onUpdate({ fontSize: v })} min={14} max={48} />
      <ColorInput label="Code color" value={p.codeColor} onChange={(v) => onUpdate({ codeColor: v })} />
      <ColorInput label="Code bg" value={p.codeBgColor} onChange={(v) => onUpdate({ codeBgColor: v })} />
      <ColorInput label="Border" value={p.borderColor} onChange={(v) => onUpdate({ borderColor: v })} />
      <AlignmentInput value={p.alignment} onChange={(v) => onUpdate({ alignment: v })} />
      <ColorInput label="Background" value={p.backgroundColor} onChange={(v) => onUpdate({ backgroundColor: v })} />
      <PaddingInput value={p.padding} onChange={(v) => onUpdate({ padding: v })} />
    </div>
  );
}

function VideoPanel({
  props: p,
  onUpdate,
}: {
  props: VideoBlockProps;
  onUpdate: (partial: Partial<VideoBlockProps>) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs text-muted-foreground">Video URL</Label>
        <Input value={p.videoUrl} onChange={(e) => onUpdate({ videoUrl: e.target.value })} placeholder="YouTube/Vimeo URL" className="h-7 text-xs mt-1" />
      </div>
      <ImageUpload
        value={p.thumbnailSrc}
        onChange={(url) => onUpdate({ thumbnailSrc: url })}
        label="Thumbnail"
      />
      <div>
        <Label className="text-xs text-muted-foreground">Alt text</Label>
        <Input value={p.alt} onChange={(e) => onUpdate({ alt: e.target.value })} className="h-7 text-xs mt-1" />
      </div>
      <AlignmentInput value={p.alignment} onChange={(v) => onUpdate({ alignment: v })} />
      <ColorInput label="Background" value={p.backgroundColor} onChange={(v) => onUpdate({ backgroundColor: v })} />
      <PaddingInput value={p.padding} onChange={(v) => onUpdate({ padding: v })} />
    </div>
  );
}

function HtmlPanel({
  props: p,
  onUpdate,
}: {
  props: HtmlBlockProps;
  onUpdate: (partial: Partial<HtmlBlockProps>) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs text-muted-foreground">HTML Code</Label>
        <textarea
          value={p.content}
          onChange={(e) => onUpdate({ content: e.target.value })}
          className="w-full mt-1 text-xs border rounded p-2 min-h-[160px] resize-y font-mono"
          placeholder="<div>...</div>"
        />
      </div>
      <PaddingInput value={p.padding} onChange={(v) => onUpdate({ padding: v })} />
    </div>
  );
}

function QuotePanel({
  props: p,
  onUpdate,
}: {
  props: QuoteBlockProps;
  onUpdate: (partial: Partial<QuoteBlockProps>) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs text-muted-foreground">Quote text</Label>
        <textarea value={p.content} onChange={(e) => onUpdate({ content: e.target.value })} className="w-full mt-1 text-xs border rounded p-2 min-h-[60px] resize-y" />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Author</Label>
        <Input value={p.author} onChange={(e) => onUpdate({ author: e.target.value })} className="h-7 text-xs mt-1" />
      </div>
      <NumberInput label="Font size" value={p.fontSize} onChange={(v) => onUpdate({ fontSize: v })} min={12} max={36} />
      <ColorInput label="Text color" value={p.color} onChange={(v) => onUpdate({ color: v })} />
      <ColorInput label="Quote line" value={p.quoteColor} onChange={(v) => onUpdate({ quoteColor: v })} />
      <AlignmentInput value={p.alignment} onChange={(v) => onUpdate({ alignment: v })} />
      <ColorInput label="Background" value={p.backgroundColor} onChange={(v) => onUpdate({ backgroundColor: v })} />
      <PaddingInput value={p.padding} onChange={(v) => onUpdate({ padding: v })} />
    </div>
  );
}

// ─── Google Fonts + System Fonts ─────────────────────────────────────────────

const FONT_OPTIONS = [
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Helvetica", value: "Helvetica, Arial, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Trebuchet MS", value: "'Trebuchet MS', sans-serif" },
  { label: "Verdana", value: "Verdana, sans-serif" },
  { label: "Times New Roman", value: "'Times New Roman', serif" },
  { label: "Courier New", value: "'Courier New', monospace" },
  { label: "Lucida", value: "'Lucida Grande', 'Lucida Sans', sans-serif" },
  // Google Fonts (web-safe via @import)
  { label: "Open Sans", value: "'Open Sans', Arial, sans-serif", google: "Open+Sans" },
  { label: "Roboto", value: "'Roboto', Arial, sans-serif", google: "Roboto" },
  { label: "Lato", value: "'Lato', Arial, sans-serif", google: "Lato" },
  { label: "Montserrat", value: "'Montserrat', Arial, sans-serif", google: "Montserrat" },
  { label: "Poppins", value: "'Poppins', Arial, sans-serif", google: "Poppins" },
  { label: "Raleway", value: "'Raleway', Arial, sans-serif", google: "Raleway" },
  { label: "Playfair Display", value: "'Playfair Display', Georgia, serif", google: "Playfair+Display" },
  { label: "Merriweather", value: "'Merriweather', Georgia, serif", google: "Merriweather" },
  { label: "Oswald", value: "'Oswald', Arial, sans-serif", google: "Oswald" },
  { label: "PT Sans", value: "'PT Sans', Arial, sans-serif", google: "PT+Sans" },
  { label: "Source Sans Pro", value: "'Source Sans 3', Arial, sans-serif", google: "Source+Sans+3" },
  { label: "Nunito", value: "'Nunito', Arial, sans-serif", google: "Nunito" },
];

// ─── Body Settings Panel ─────────────────────────────────────────────────────

export function BodySettingsPanel({
  settings,
  onUpdate,
}: {
  settings: EmailDesign["bodySettings"];
  onUpdate: (partial: Partial<EmailDesign["bodySettings"]>) => void;
}) {
  return (
    <div className="space-y-3 p-4">
      <div className="text-sm font-semibold">Email Settings</div>
      <ColorInput label="Background" value={settings.backgroundColor} onChange={(v) => onUpdate({ backgroundColor: v })} />
      <NumberInput label="Content width" value={settings.contentWidth} onChange={(v) => onUpdate({ contentWidth: v })} min={400} max={800} />
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground w-24 shrink-0">Font</Label>
        <Select value={settings.fontFamily} onValueChange={(v) => onUpdate({ fontFamily: v })}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {FONT_OPTIONS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                <span style={{ fontFamily: f.value }}>{f.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// ─── Property Panel Dispatcher ───────────────────────────────────────────────

const BLOCK_LABELS: Record<BlockType, string> = {
  text: "Text",
  image: "Image",
  button: "Button",
  columns: "Columns",
  section: "Section",
  divider: "Divider",
  spacer: "Spacer",
  social: "Social Links",
  header: "Header",
  footer: "Footer",
  hero: "Hero",
  product: "Product",
  coupon: "Coupon",
  video: "Video",
  html: "HTML",
  quote: "Quote",
};

export function PropertyPanel({
  block,
  onUpdate,
}: {
  block: EmailBlock;
  onUpdate: (partial: Record<string, unknown>) => void;
}) {
  return (
    <div className="p-4 space-y-3">
      <div className="text-sm font-semibold">{BLOCK_LABELS[block.type]} Settings</div>
      {block.type === "text" && <TextPanel props={block.props as TextBlockProps} onUpdate={onUpdate} />}
      {block.type === "image" && <ImagePanel props={block.props as ImageBlockProps} onUpdate={onUpdate} />}
      {block.type === "button" && <ButtonPanel props={block.props as ButtonBlockProps} onUpdate={onUpdate} />}
      {block.type === "columns" && <ColumnsPanel props={block.props as ColumnsBlockProps} onUpdate={onUpdate} />}
      {block.type === "section" && <SectionPanel props={block.props as SectionBlockProps} onUpdate={onUpdate} />}
      {block.type === "divider" && <DividerPanel props={block.props as DividerBlockProps} onUpdate={onUpdate} />}
      {block.type === "spacer" && <SpacerPanel props={block.props as SpacerBlockProps} onUpdate={onUpdate} />}
      {block.type === "social" && <SocialPanel props={block.props as SocialBlockProps} onUpdate={onUpdate} />}
      {block.type === "header" && <HeaderPanel props={block.props as HeaderBlockProps} onUpdate={onUpdate} />}
      {block.type === "footer" && <FooterPanel props={block.props as FooterBlockProps} onUpdate={onUpdate} />}
      {block.type === "hero" && <HeroPanel props={block.props as HeroBlockProps} onUpdate={onUpdate} />}
      {block.type === "product" && <ProductPanel props={block.props as ProductBlockProps} onUpdate={onUpdate} />}
      {block.type === "coupon" && <CouponPanel props={block.props as CouponBlockProps} onUpdate={onUpdate} />}
      {block.type === "video" && <VideoPanel props={block.props as VideoBlockProps} onUpdate={onUpdate} />}
      {block.type === "html" && <HtmlPanel props={block.props as HtmlBlockProps} onUpdate={onUpdate} />}
      {block.type === "quote" && <QuotePanel props={block.props as QuoteBlockProps} onUpdate={onUpdate} />}
    </div>
  );
}

export { FONT_OPTIONS };
