"use client";

import React, { useEffect, useImperativeHandle, forwardRef, useState, useCallback, useRef, useMemo } from "react";
import type { EmailDesign, BlockType } from "@/lib/email-builder/types";
import { useEmailBuilder } from "./use-email-builder";
import { BuilderSidebar } from "./builder-sidebar";
import { BuilderCanvas } from "./builder-canvas";
import { PropertyPanel, BodySettingsPanel, FONT_OPTIONS } from "./property-panels";
import { ColumnLayoutPicker } from "./column-layout-picker";
import { ScrollArea } from "@/components/ui/scroll-area";

// ─── Image Upload Helper ─────────────────────────────────────────────────────

async function compressAndUpload(file: File): Promise<string | null> {
  // Client-side compression
  const compressed = await new Promise<File>((resolve) => {
    if (file.type === "image/svg+xml" || file.size < 500_000) {
      resolve(file);
      return;
    }
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > 1200) {
        height = Math.round((height * 1200) / width);
        width = 1200;
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
            resolve(file);
          }
        },
        "image/jpeg",
        0.85
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });

  const formData = new FormData();
  formData.append("file", compressed);
  try {
    const res = await fetch("/api/outreach/upload", { method: "POST", body: formData });
    if (!res.ok) return null;
    const data = await res.json();
    return data.url || null;
  } catch {
    return null;
  }
}

// ─── Google Font Loader ──────────────────────────────────────────────────────

function GoogleFontLink({ fontFamily }: { fontFamily: string }) {
  const font = FONT_OPTIONS.find((f) => f.value === fontFamily);
  if (!font || !("google" in font) || !font.google) return null;
  return (
    // eslint-disable-next-line @next/next/no-page-custom-font
    <link
      rel="stylesheet"
      href={`https://fonts.googleapis.com/css2?family=${font.google}:wght@400;600;700&display=swap`}
    />
  );
}

// ─── Editor API (ref handle for page.tsx) ────────────────────────────────────

export interface EmailBuilderHandle {
  getHtml: () => string;
  getDesignJson: () => EmailDesign;
  loadDesign: (d: EmailDesign) => void;
  undo: () => void;
  redo: () => void;
}

interface EmailBuilderProps {
  onEditor?: (handle: EmailBuilderHandle) => void;
  existingDesign?: Record<string, unknown> | null;
  onUndoRedo?: (canUndo: boolean, canRedo: boolean) => void;
}

// Tabs
type SidebarTab = "content" | "styles";

const EmailBuilderInner = forwardRef<EmailBuilderHandle, EmailBuilderProps>(
  function EmailBuilderInner({ onEditor, existingDesign, onUndoRedo }, ref) {
    const builder = useEmailBuilder();
    const [sidebarTab, setSidebarTab] = useState<SidebarTab>("content");
    const [columnPickerOpen, setColumnPickerOpen] = useState(false);

    const handleAddBlock = useCallback(
      (type: BlockType) => {
        if (type === "columns") {
          setColumnPickerOpen(true);
        } else {
          builder.addBlock(type);
        }
      },
      [builder]
    );

    // Use a ref so the handle always delegates to the latest builder
    const builderRef = useRef(builder);
    builderRef.current = builder;

    const handle: EmailBuilderHandle = useMemo(
      () => ({
        getHtml: () => builderRef.current.getHtml(),
        getDesignJson: () => builderRef.current.getDesignJson(),
        loadDesign: (d: EmailDesign) => builderRef.current.loadDesign(d),
        undo: () => builderRef.current.undo(),
        redo: () => builderRef.current.redo(),
      }),
      []
    );

    useImperativeHandle(ref, () => handle, [handle]);

    // Notify parent of handle (stable — fires once)
    useEffect(() => {
      onEditor?.(handle);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Notify parent of undo/redo state
    useEffect(() => {
      onUndoRedo?.(builder.canUndo, builder.canRedo);
    }, [builder.canUndo, builder.canRedo, onUndoRedo]);

    // Load existing design (supports v1 and v2 — migration happens in loadDesign)
    useEffect(() => {
      if (existingDesign && (existingDesign as unknown as EmailDesign).version) {
        builder.loadDesign(existingDesign as unknown as EmailDesign);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [existingDesign]);

    // Auto-switch to styles when block selected
    useEffect(() => {
      if (builder.selectedBlock) {
        setSidebarTab("styles");
      }
    }, [builder.selectedBlockId]);

    const handleSelectNested = (blockId: string, parentId: string, colId: string) => {
      builder.setSelectedBlockId(blockId);
      builder.setSelectedColumnCtx({ parentBlockId: parentId, columnId: colId });
    };

    // Track pending drop index for columns added via canvas drop zones
    const [pendingColumnIndex, setPendingColumnIndex] = useState<number | undefined>(undefined);

    const handleCanvasAddBlock = useCallback(
      (type: BlockType, index?: number) => {
        if (type === "columns") {
          setPendingColumnIndex(index);
          setColumnPickerOpen(true);
        } else {
          builder.addBlock(type, index);
        }
      },
      [builder]
    );

    const handleColumnLayoutSelect = useCallback(
      (widths: number[]) => {
        builder.addColumnsBlock(widths, pendingColumnIndex);
        setPendingColumnIndex(undefined);
      },
      [builder, pendingColumnIndex]
    );

    // File drop: upload image and add as image block at index
    const handleDropFile = useCallback(
      async (file: File, index?: number) => {
        // Add a placeholder image block immediately
        builder.addBlock("image", index);
        const blockId = builder.selectedBlockId;
        // Upload in background and update src
        const url = await compressAndUpload(file);
        if (url && blockId) {
          builder.updateBlockProps(blockId, { src: url, alt: file.name });
        }
      },
      [builder]
    );

    // File drop into a column/section
    const handleDropFileInColumn = useCallback(
      async (parentId: string, colId: string, file: File) => {
        builder.addBlockToColumn(parentId, colId, "image");
        const blockId = builder.selectedBlockId;
        const url = await compressAndUpload(file);
        if (url && blockId) {
          builder.updateBlockProps(blockId, { src: url, alt: file.name });
        }
      },
      [builder]
    );

    return (
      <div className="flex h-full">
        <GoogleFontLink fontFamily={builder.design.bodySettings.fontFamily} />
        <ColumnLayoutPicker
          open={columnPickerOpen}
          onClose={() => {
            setColumnPickerOpen(false);
            setPendingColumnIndex(undefined);
          }}
          onSelect={handleColumnLayoutSelect}
        />
        {/* Left Sidebar */}
        <div className="w-[326px] border-r bg-white flex flex-col shrink-0">
          {/* Tabs */}
          <div className="flex border-b">
            <button
              onClick={() => {
                setSidebarTab("content");
                builder.setSelectedBlockId(null);
              }}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                sidebarTab === "content"
                  ? "text-slate-900 border-b-2 border-slate-900"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Content
            </button>
            <button
              onClick={() => setSidebarTab("styles")}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                sidebarTab === "styles"
                  ? "text-slate-900 border-b-2 border-slate-900"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Styles
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden">
            {sidebarTab === "content" && (
              <BuilderSidebar onAddBlock={handleAddBlock} />
            )}
            {sidebarTab === "styles" && (
              <ScrollArea className="h-full">
                {builder.selectedBlock ? (
                  <PropertyPanel
                    block={builder.selectedBlock}
                    onUpdate={(partial) =>
                      builder.updateBlockProps(builder.selectedBlockId!, partial)
                    }
                  />
                ) : (
                  <BodySettingsPanel
                    settings={builder.design.bodySettings}
                    onUpdate={builder.updateBodySettings}
                  />
                )}
              </ScrollArea>
            )}
          </div>
        </div>

        {/* Canvas */}
        <BuilderCanvas
          design={builder.design}
          selectedBlockId={builder.selectedBlockId}
          onSelectBlock={(id) => {
            builder.setSelectedBlockId(id);
            builder.setSelectedColumnCtx(null);
          }}
          onSelectNested={handleSelectNested}
          onDeleteBlock={builder.removeBlock}
          onDuplicateBlock={builder.duplicateBlock}
          onMoveBlock={builder.moveBlock}
          onReorderBlocks={builder.reorderBlocks}
          onUpdateBlockProps={builder.updateBlockProps}
          onAddBlock={handleCanvasAddBlock}
          onAddBlockToColumn={(parentId, colId, type) =>
            builder.addBlockToColumn(parentId, colId, type)
          }
          onDropFile={handleDropFile}
          onDropFileInColumn={handleDropFileInColumn}
          onAddSection={(index) => builder.addSection(index)}
        />
      </div>
    );
  }
);

// Default export for dynamic import
export default function EmailBuilder(props: EmailBuilderProps) {
  return <EmailBuilderInner {...props} />;
}
