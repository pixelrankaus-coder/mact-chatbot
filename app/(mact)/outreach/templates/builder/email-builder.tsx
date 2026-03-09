"use client";

import React, { useEffect, useImperativeHandle, forwardRef, useState } from "react";
import type { EmailDesign, BlockType } from "@/lib/email-builder/types";
import { useEmailBuilder } from "./use-email-builder";
import { BuilderSidebar } from "./builder-sidebar";
import { BuilderCanvas } from "./builder-canvas";
import { PropertyPanel, BodySettingsPanel, FONT_OPTIONS } from "./property-panels";
import { ScrollArea } from "@/components/ui/scroll-area";

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

    // Expose API via ref
    const handle: EmailBuilderHandle = {
      getHtml: builder.getHtml,
      getDesignJson: builder.getDesignJson,
      loadDesign: builder.loadDesign,
      undo: builder.undo,
      redo: builder.redo,
    };

    useImperativeHandle(ref, () => handle, [builder]);

    // Notify parent of handle
    useEffect(() => {
      onEditor?.(handle);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Notify parent of undo/redo state
    useEffect(() => {
      onUndoRedo?.(builder.canUndo, builder.canRedo);
    }, [builder.canUndo, builder.canRedo, onUndoRedo]);

    // Load existing design
    useEffect(() => {
      if (existingDesign && (existingDesign as EmailDesign).version === 1) {
        builder.loadDesign(existingDesign as EmailDesign);
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

    return (
      <div className="flex h-full">
        <GoogleFontLink fontFamily={builder.design.bodySettings.fontFamily} />
        {/* Left Sidebar */}
        <div className="w-[272px] border-r bg-white flex flex-col shrink-0">
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
              <BuilderSidebar onAddBlock={(type) => builder.addBlock(type)} />
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
          onAddBlock={builder.addBlock}
          onAddBlockToColumn={(parentId, colId, type) =>
            builder.addBlockToColumn(parentId, colId, type)
          }
        />
      </div>
    );
  }
);

// Default export for dynamic import
export default function EmailBuilder(props: EmailBuilderProps) {
  return <EmailBuilderInner {...props} />;
}
