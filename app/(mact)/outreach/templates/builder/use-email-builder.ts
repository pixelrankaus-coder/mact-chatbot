"use client";

import { useState, useCallback, useRef } from "react";
import type { EmailDesign, EmailBlock, BlockType, ColumnsBlockProps, SectionBlockProps } from "@/lib/email-builder/types";
import { emptyDesign, createBlock, uid } from "@/lib/email-builder/defaults";
import { exportToHtml } from "@/lib/email-builder/html-export";

const MAX_HISTORY = 50;

export function useEmailBuilder() {
  const [design, setDesign] = useState<EmailDesign>(emptyDesign());
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [selectedColumnCtx, setSelectedColumnCtx] = useState<{
    parentBlockId: string;
    columnId: string;
  } | null>(null);

  // Undo/redo stacks
  const undoStack = useRef<EmailDesign[]>([]);
  const redoStack = useRef<EmailDesign[]>([]);

  const pushHistory = useCallback((d: EmailDesign) => {
    undoStack.current.push(JSON.parse(JSON.stringify(d)));
    if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
    redoStack.current = [];
  }, []);

  const updateDesign = useCallback(
    (updater: (prev: EmailDesign) => EmailDesign) => {
      setDesign((prev) => {
        pushHistory(prev);
        return updater(prev);
      });
    },
    [pushHistory]
  );

  // ─── Undo / Redo ────────────────────────────────────────────────────────────

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    setDesign((prev) => {
      redoStack.current.push(JSON.parse(JSON.stringify(prev)));
      return undoStack.current.pop()!;
    });
  }, []);

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    setDesign((prev) => {
      undoStack.current.push(JSON.parse(JSON.stringify(prev)));
      return redoStack.current.pop()!;
    });
  }, []);

  const canUndo = undoStack.current.length > 0;
  const canRedo = redoStack.current.length > 0;

  // ─── Block Operations ──────────────────────────────────────────────────────

  const addBlock = useCallback(
    (type: BlockType, index?: number) => {
      const block = createBlock(type);
      updateDesign((d) => {
        const blocks = [...d.blocks];
        if (index !== undefined) {
          blocks.splice(index, 0, block);
        } else {
          blocks.push(block);
        }
        return { ...d, blocks };
      });
      setSelectedBlockId(block.id);
      setSelectedColumnCtx(null);
    },
    [updateDesign]
  );

  const addBlockToColumn = useCallback(
    (parentBlockId: string, columnId: string, type: BlockType) => {
      const block = createBlock(type);
      updateDesign((d) => {
        const blocks = d.blocks.map((b) => {
          if (b.id !== parentBlockId) return b;
          if (b.type === "columns") {
            const cols = (b.props as ColumnsBlockProps).columns.map((col) => {
              if (col.id !== columnId) return col;
              return { ...col, blocks: [...col.blocks, block] };
            });
            return { ...b, props: { ...b.props, columns: cols } };
          }
          if (b.type === "section") {
            return { ...b, props: { ...b.props, blocks: [...(b.props as SectionBlockProps).blocks, block] } };
          }
          return b;
        });
        return { ...d, blocks };
      });
      setSelectedBlockId(block.id);
      setSelectedColumnCtx({ parentBlockId, columnId });
    },
    [updateDesign]
  );

  const removeBlock = useCallback(
    (blockId: string) => {
      updateDesign((d) => {
        // Try top-level
        const topIdx = d.blocks.findIndex((b) => b.id === blockId);
        if (topIdx !== -1) {
          const blocks = d.blocks.filter((b) => b.id !== blockId);
          return { ...d, blocks };
        }
        // Try inside columns or sections
        const blocks = d.blocks.map((b) => {
          if (b.type === "columns") {
            const cols = (b.props as ColumnsBlockProps).columns.map((col) => ({
              ...col,
              blocks: col.blocks.filter((cb) => cb.id !== blockId),
            }));
            return { ...b, props: { ...b.props, columns: cols } };
          }
          if (b.type === "section") {
            return { ...b, props: { ...b.props, blocks: (b.props as SectionBlockProps).blocks.filter((cb) => cb.id !== blockId) } };
          }
          return b;
        });
        return { ...d, blocks };
      });
      if (selectedBlockId === blockId) {
        setSelectedBlockId(null);
        setSelectedColumnCtx(null);
      }
    },
    [updateDesign, selectedBlockId]
  );

  const duplicateBlock = useCallback(
    (blockId: string) => {
      updateDesign((d) => {
        // Top-level
        const topIdx = d.blocks.findIndex((b) => b.id === blockId);
        if (topIdx !== -1) {
          const original = d.blocks[topIdx];
          const clone: EmailBlock = JSON.parse(JSON.stringify(original));
          clone.id = uid();
          // Re-id nested columns
          if (clone.type === "columns") {
            (clone.props as ColumnsBlockProps).columns.forEach((col) => {
              col.id = uid();
              col.blocks.forEach((b) => (b.id = uid()));
            });
          }
          const blocks = [...d.blocks];
          blocks.splice(topIdx + 1, 0, clone);
          return { ...d, blocks };
        }
        // Inside columns or sections
        const blocks = d.blocks.map((b) => {
          if (b.type === "columns") {
            const cols = (b.props as ColumnsBlockProps).columns.map((col) => {
              const idx = col.blocks.findIndex((cb) => cb.id === blockId);
              if (idx === -1) return col;
              const clone: EmailBlock = JSON.parse(JSON.stringify(col.blocks[idx]));
              clone.id = uid();
              const newBlocks = [...col.blocks];
              newBlocks.splice(idx + 1, 0, clone);
              return { ...col, blocks: newBlocks };
            });
            return { ...b, props: { ...b.props, columns: cols } };
          }
          if (b.type === "section") {
            const sBlocks = (b.props as SectionBlockProps).blocks;
            const idx = sBlocks.findIndex((cb) => cb.id === blockId);
            if (idx === -1) return b;
            const clone: EmailBlock = JSON.parse(JSON.stringify(sBlocks[idx]));
            clone.id = uid();
            const newBlocks = [...sBlocks];
            newBlocks.splice(idx + 1, 0, clone);
            return { ...b, props: { ...b.props, blocks: newBlocks } };
          }
          return b;
        });
        return { ...d, blocks };
      });
    },
    [updateDesign]
  );

  const moveBlock = useCallback(
    (blockId: string, direction: "up" | "down") => {
      updateDesign((d) => {
        const idx = d.blocks.findIndex((b) => b.id === blockId);
        if (idx === -1) {
          // Try inside columns or sections
          const blocks = d.blocks.map((b) => {
            if (b.type === "columns") {
              const cols = (b.props as ColumnsBlockProps).columns.map((col) => {
                const cIdx = col.blocks.findIndex((cb) => cb.id === blockId);
                if (cIdx === -1) return col;
                const newIdx = direction === "up" ? cIdx - 1 : cIdx + 1;
                if (newIdx < 0 || newIdx >= col.blocks.length) return col;
                const newBlocks = [...col.blocks];
                [newBlocks[cIdx], newBlocks[newIdx]] = [newBlocks[newIdx], newBlocks[cIdx]];
                return { ...col, blocks: newBlocks };
              });
              return { ...b, props: { ...b.props, columns: cols } };
            }
            if (b.type === "section") {
              const sBlocks = (b.props as SectionBlockProps).blocks;
              const cIdx = sBlocks.findIndex((cb) => cb.id === blockId);
              if (cIdx === -1) return b;
              const newIdx = direction === "up" ? cIdx - 1 : cIdx + 1;
              if (newIdx < 0 || newIdx >= sBlocks.length) return b;
              const newBlocks = [...sBlocks];
              [newBlocks[cIdx], newBlocks[newIdx]] = [newBlocks[newIdx], newBlocks[cIdx]];
              return { ...b, props: { ...b.props, blocks: newBlocks } };
            }
            return b;
          });
          return { ...d, blocks };
        }
        const newIdx = direction === "up" ? idx - 1 : idx + 1;
        if (newIdx < 0 || newIdx >= d.blocks.length) return d;
        const blocks = [...d.blocks];
        [blocks[idx], blocks[newIdx]] = [blocks[newIdx], blocks[idx]];
        return { ...d, blocks };
      });
    },
    [updateDesign]
  );

  const reorderBlocks = useCallback(
    (oldIndex: number, newIndex: number) => {
      if (oldIndex === newIndex) return;
      updateDesign((d) => {
        const blocks = [...d.blocks];
        const [moved] = blocks.splice(oldIndex, 1);
        blocks.splice(newIndex, 0, moved);
        return { ...d, blocks };
      });
    },
    [updateDesign]
  );

  const updateBlockProps = useCallback(
    (blockId: string, partial: Record<string, unknown>) => {
      updateDesign((d) => {
        // Top-level
        const topIdx = d.blocks.findIndex((b) => b.id === blockId);
        if (topIdx !== -1) {
          const blocks = d.blocks.map((b) =>
            b.id === blockId ? { ...b, props: { ...b.props, ...partial } } : b
          );
          return { ...d, blocks };
        }
        // Inside columns or sections
        const blocks = d.blocks.map((b) => {
          if (b.type === "columns") {
            const cols = (b.props as ColumnsBlockProps).columns.map((col) => ({
              ...col,
              blocks: col.blocks.map((cb) =>
                cb.id === blockId ? { ...cb, props: { ...cb.props, ...partial } } : cb
              ),
            }));
            return { ...b, props: { ...b.props, columns: cols } };
          }
          if (b.type === "section") {
            const sBlocks = (b.props as SectionBlockProps).blocks.map((cb) =>
              cb.id === blockId ? { ...cb, props: { ...cb.props, ...partial } } : cb
            );
            return { ...b, props: { ...b.props, blocks: sBlocks } };
          }
          return b;
        });
        return { ...d, blocks };
      });
    },
    [updateDesign]
  );

  const updateBodySettings = useCallback(
    (partial: Partial<EmailDesign["bodySettings"]>) => {
      updateDesign((d) => ({
        ...d,
        bodySettings: { ...d.bodySettings, ...partial },
      }));
    },
    [updateDesign]
  );

  // ─── Getters ───────────────────────────────────────────────────────────────

  const getHtml = useCallback(() => exportToHtml(design), [design]);

  const getDesignJson = useCallback(() => design, [design]);

  const loadDesign = useCallback(
    (d: EmailDesign) => {
      pushHistory(design);
      setDesign(d);
      setSelectedBlockId(null);
      setSelectedColumnCtx(null);
    },
    [design, pushHistory]
  );

  const selectedBlock = (() => {
    if (!selectedBlockId) return null;
    // Top-level
    const found = design.blocks.find((b) => b.id === selectedBlockId);
    if (found) return found;
    // Inside columns or sections
    for (const b of design.blocks) {
      if (b.type === "columns") {
        for (const col of (b.props as ColumnsBlockProps).columns) {
          const cb = col.blocks.find((cb) => cb.id === selectedBlockId);
          if (cb) return cb;
        }
      }
      if (b.type === "section") {
        const cb = (b.props as SectionBlockProps).blocks.find((cb) => cb.id === selectedBlockId);
        if (cb) return cb;
      }
    }
    return null;
  })();

  return {
    design,
    selectedBlockId,
    selectedColumnCtx,
    selectedBlock,
    setSelectedBlockId,
    setSelectedColumnCtx,
    addBlock,
    addBlockToColumn,
    removeBlock,
    duplicateBlock,
    moveBlock,
    reorderBlocks,
    updateBlockProps,
    updateBodySettings,
    undo,
    redo,
    canUndo,
    canRedo,
    getHtml,
    getDesignJson,
    loadDesign,
  };
}
