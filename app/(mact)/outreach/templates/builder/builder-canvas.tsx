"use client";

import React, { useState, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { EmailBlock, EmailDesign, BlockType, ColumnsBlockProps, SectionBlockProps } from "@/lib/email-builder/types";
import { BlockRenderer } from "@/lib/email-builder/block-renderers";
import {
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  GripVertical,
  Plus,
} from "lucide-react";

// ─── Block Toolbar ───────────────────────────────────────────────────────────

function BlockToolbar({
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  label,
}: {
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  label: string;
}) {
  return (
    <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex items-center gap-0.5 bg-white border rounded-md shadow-sm px-1 py-0.5 z-20 opacity-0 group-hover/block:opacity-100 transition-opacity">
      <span className="text-[10px] text-muted-foreground px-1.5 font-medium">
        {label}
      </span>
      <button
        onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
        className="p-0.5 hover:bg-slate-100 rounded"
        title="Move up"
      >
        <ChevronUp className="h-3.5 w-3.5 text-slate-500" />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
        className="p-0.5 hover:bg-slate-100 rounded"
        title="Move down"
      >
        <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
        className="p-0.5 hover:bg-slate-100 rounded"
        title="Duplicate"
      >
        <Copy className="h-3.5 w-3.5 text-slate-500" />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="p-0.5 hover:bg-red-50 rounded"
        title="Delete"
      >
        <Trash2 className="h-3.5 w-3.5 text-red-500" />
      </button>
    </div>
  );
}

// ─── Sortable Block Wrapper ──────────────────────────────────────────────────

const BLOCK_LABELS: Record<string, string> = {
  text: "Text",
  image: "Image",
  button: "Button",
  columns: "Columns",
  divider: "Divider",
  spacer: "Spacer",
  social: "Social",
  header: "Header",
  footer: "Footer",
  hero: "Hero",
  product: "Product",
  coupon: "Coupon",
  video: "Video",
  html: "HTML",
  quote: "Quote",
  section: "Section",
};

interface SortableBlockProps {
  block: EmailBlock;
  design: EmailDesign;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onUpdateProps: (partial: Record<string, unknown>) => void;
  onAddBlockToColumn: (parentId: string, colId: string, type: BlockType) => void;
  onDropFileInColumn: (parentId: string, colId: string, file: File) => void;
  onSelectNested: (blockId: string, parentId: string, colId: string) => void;
  selectedBlockId: string | null;
  onDeleteNested: (blockId: string) => void;
  onDuplicateNested: (blockId: string) => void;
  onMoveNested: (blockId: string, dir: "up" | "down") => void;
  onUpdateNestedProps: (blockId: string, partial: Record<string, unknown>) => void;
}

function SortableBlock({
  block,
  design,
  selected,
  onSelect,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onUpdateProps,
  onAddBlockToColumn,
  onDropFileInColumn,
  onSelectNested,
  selectedBlockId,
  onDeleteNested,
  onDuplicateNested,
  onMoveNested,
  onUpdateNestedProps,
}: SortableBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  // Nested block renderer for columns
  const renderNestedBlock = (nestedBlock: EmailBlock, columnId: string) => {
    const isNestedSelected = selectedBlockId === nestedBlock.id;
    return (
      <div
        key={nestedBlock.id}
        onClick={(e) => {
          e.stopPropagation();
          onSelectNested(nestedBlock.id, block.id, columnId);
        }}
        className={`relative group/nested cursor-pointer transition-all ${
          isNestedSelected
            ? "ring-2 ring-blue-500 ring-inset"
            : "hover:ring-1 hover:ring-blue-300 hover:ring-inset"
        }`}
      >
        {isNestedSelected && (
          <div className="absolute -top-7 left-1/2 -translate-x-1/2 flex items-center gap-0.5 bg-white border rounded-md shadow-sm px-1 py-0.5 z-20">
            <span className="text-[10px] text-muted-foreground px-1 font-medium">
              {BLOCK_LABELS[nestedBlock.type]}
            </span>
            <button onClick={(e) => { e.stopPropagation(); onMoveNested(nestedBlock.id, "up"); }} className="p-0.5 hover:bg-slate-100 rounded">
              <ChevronUp className="h-3 w-3 text-slate-500" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onMoveNested(nestedBlock.id, "down"); }} className="p-0.5 hover:bg-slate-100 rounded">
              <ChevronDown className="h-3 w-3 text-slate-500" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onDuplicateNested(nestedBlock.id); }} className="p-0.5 hover:bg-slate-100 rounded">
              <Copy className="h-3 w-3 text-slate-500" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onDeleteNested(nestedBlock.id); }} className="p-0.5 hover:bg-red-50 rounded">
              <Trash2 className="h-3 w-3 text-red-500" />
            </button>
          </div>
        )}
        <BlockRenderer
          block={nestedBlock}
          design={design}
          selected={isNestedSelected}
          onUpdate={(partial) => onUpdateNestedProps(nestedBlock.id, partial)}
        />
      </div>
    );
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      className={`relative group/block cursor-pointer transition-all ${
        selected
          ? "ring-2 ring-blue-500"
          : "hover:ring-1 hover:ring-blue-300"
      }`}
    >
      {/* Section badge */}
      {block.type === "section" && selected && (
        <div className="absolute -top-0.5 left-0 z-20">
          <span className="text-[10px] font-semibold text-white bg-blue-500 px-1.5 py-0.5 rounded-br rounded-tl">
            Section
          </span>
        </div>
      )}

      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute -left-8 top-1/2 -translate-y-1/2 p-1 cursor-grab opacity-0 group-hover/block:opacity-100 transition-opacity z-10 active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4 text-slate-400" />
      </div>

      {/* Toolbar */}
      <BlockToolbar
        label={BLOCK_LABELS[block.type] || block.type}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
      />

      <BlockRenderer
        block={block}
        design={design}
        selected={selected}
        onUpdate={onUpdateProps}
        renderNestedBlock={renderNestedBlock}
        onDropInColumn={(colId, type) => onAddBlockToColumn(block.id, colId, type as BlockType)}
        onDropFileInColumn={(colId, file) => onDropFileInColumn(block.id, colId, file)}
      />
    </div>
  );
}

// ─── Drop Zone Between Blocks ────────────────────────────────────────────────

function DropZone({
  index,
  onDrop,
  onDropFile,
  onAddSection,
}: {
  index: number;
  onDrop: (type: BlockType, index: number) => void;
  onDropFile?: (file: File, index: number) => void;
  onAddSection?: (index: number) => void;
}) {
  const [active, setActive] = useState(false);

  return (
    <div
      className={`relative group/dropzone transition-all ${active ? "h-12" : "h-3"}`}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.types.includes("text/block-type") || e.dataTransfer.types.includes("Files")) {
          setActive(true);
        }
      }}
      onDragLeave={() => setActive(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setActive(false);
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type.startsWith("image/") && onDropFile) {
          onDropFile(files[0], index);
          return;
        }
        const type = e.dataTransfer.getData("text/block-type") as BlockType;
        if (type) onDrop(type, index);
      }}
    >
      {active && (
        <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-1 bg-blue-400 rounded-full" />
      )}
      {/* + button between blocks */}
      {onAddSection && !active && (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center opacity-0 group-hover/dropzone:opacity-100 transition-opacity z-10">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddSection(index);
            }}
            className="h-5 w-5 rounded-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center shadow-sm transition-colors"
            title="Add section"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyCanvas({ onDrop, onDropFile }: { onDrop: (type: BlockType) => void; onDropFile?: (file: File) => void }) {
  const [active, setActive] = useState(false);
  return (
    <div
      className={`flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg transition-colors ${
        active
          ? "border-blue-400 bg-blue-50"
          : "border-slate-200 bg-white"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        if (e.dataTransfer.types.includes("text/block-type") || e.dataTransfer.types.includes("Files")) {
          setActive(true);
        }
      }}
      onDragLeave={() => setActive(false)}
      onDrop={(e) => {
        e.preventDefault();
        setActive(false);
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type.startsWith("image/") && onDropFile) {
          onDropFile(files[0]);
          return;
        }
        const type = e.dataTransfer.getData("text/block-type") as BlockType;
        if (type) onDrop(type);
      }}
    >
      <div className="text-slate-400 text-center">
        <p className="text-sm font-medium mb-1">Drag a block or image here to get started</p>
        <p className="text-xs">Or click any block in the sidebar</p>
      </div>
    </div>
  );
}

// ─── Canvas ──────────────────────────────────────────────────────────────────

interface BuilderCanvasProps {
  design: EmailDesign;
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  onSelectNested: (blockId: string, parentId: string, colId: string) => void;
  onDeleteBlock: (id: string) => void;
  onDuplicateBlock: (id: string) => void;
  onMoveBlock: (id: string, dir: "up" | "down") => void;
  onReorderBlocks: (oldIndex: number, newIndex: number) => void;
  onUpdateBlockProps: (id: string, partial: Record<string, unknown>) => void;
  onAddBlock: (type: BlockType, index?: number) => void;
  onAddBlockToColumn: (parentId: string, colId: string, type: BlockType) => void;
  onDropFile?: (file: File, index?: number) => void;
  onDropFileInColumn?: (parentId: string, colId: string, file: File) => void;
  onAddSection?: (index: number) => void;
}

export function BuilderCanvas({
  design,
  selectedBlockId,
  onSelectBlock,
  onSelectNested,
  onDeleteBlock,
  onDuplicateBlock,
  onMoveBlock,
  onReorderBlocks,
  onUpdateBlockProps,
  onAddBlock,
  onAddBlockToColumn,
  onDropFile,
  onDropFileInColumn,
  onAddSection,
}: BuilderCanvasProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = design.blocks.findIndex((b) => b.id === active.id);
      const newIndex = design.blocks.findIndex((b) => b.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        onReorderBlocks(oldIndex, newIndex);
      }
    },
    [design.blocks, onReorderBlocks]
  );

  const activeBlock = activeId ? design.blocks.find((b) => b.id === activeId) : null;

  return (
    <div
      className="flex-1 overflow-auto"
      style={{ backgroundColor: design.bodySettings.backgroundColor }}
      onClick={() => onSelectBlock(null)}
    >
      <div
        className="mx-auto my-6 px-6"
        style={{
          maxWidth: design.bodySettings.contentWidth + 48,
          fontFamily: design.bodySettings.fontFamily,
        }}
      >
        {design.blocks.length === 0 ? (
          <EmptyCanvas onDrop={(type) => onAddBlock(type)} onDropFile={onDropFile ? (f) => onDropFile(f) : undefined} />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={design.blocks.map((b) => b.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="bg-white shadow-sm relative" style={{ paddingLeft: 32, paddingRight: 16 }}>
                <DropZone index={0} onDrop={(type, idx) => onAddBlock(type, idx)} onDropFile={onDropFile ? (f, idx) => onDropFile(f, idx) : undefined} onAddSection={onAddSection} />
                {design.blocks.map((block, i) => (
                  <React.Fragment key={block.id}>
                    <SortableBlock
                      block={block}
                      design={design}
                      selected={selectedBlockId === block.id}
                      onSelect={() => onSelectBlock(block.id)}
                      onDelete={() => onDeleteBlock(block.id)}
                      onDuplicate={() => onDuplicateBlock(block.id)}
                      onMoveUp={() => onMoveBlock(block.id, "up")}
                      onMoveDown={() => onMoveBlock(block.id, "down")}
                      onUpdateProps={(partial) => onUpdateBlockProps(block.id, partial)}
                      onAddBlockToColumn={onAddBlockToColumn}
                      onDropFileInColumn={onDropFileInColumn || (() => {})}
                      onSelectNested={(blockId, parentId, colId) => onSelectNested(blockId, parentId, colId)}
                      selectedBlockId={selectedBlockId}
                      onDeleteNested={onDeleteBlock}
                      onDuplicateNested={onDuplicateBlock}
                      onMoveNested={(id, dir) => onMoveBlock(id, dir)}
                      onUpdateNestedProps={onUpdateBlockProps}
                    />
                    <DropZone
                      index={i + 1}
                      onDrop={(type, idx) => onAddBlock(type, idx)}
                      onDropFile={onDropFile ? (f, idx) => onDropFile(f, idx) : undefined}
                      onAddSection={onAddSection}
                    />
                  </React.Fragment>
                ))}
              </div>
            </SortableContext>

            <DragOverlay>
              {activeBlock ? (
                <div className="opacity-70 shadow-lg rounded overflow-hidden pointer-events-none bg-white" style={{ maxWidth: design.bodySettings.contentWidth }}>
                  <BlockRenderer block={activeBlock} design={design} />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </div>
  );
}
