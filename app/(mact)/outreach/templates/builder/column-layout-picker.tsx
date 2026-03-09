"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { COLUMN_LAYOUT_PRESETS, type ColumnLayoutPreset } from "@/lib/email-builder/defaults";

interface ColumnLayoutPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (widths: number[]) => void;
}

function LayoutPreviewBar({ widths }: { widths: number[] }) {
  return (
    <div className="flex gap-[2px] h-8 w-full">
      {widths.map((w, i) => (
        <div
          key={i}
          className="bg-slate-200 rounded-[3px]"
          style={{ width: `${w}%` }}
        />
      ))}
    </div>
  );
}

export function ColumnLayoutPicker({
  open,
  onClose,
  onSelect,
}: ColumnLayoutPickerProps) {
  const [columnCount, setColumnCount] = useState(2);
  const presets = COLUMN_LAYOUT_PRESETS[columnCount] || [];
  const [selectedIdx, setSelectedIdx] = useState(0);

  const handleCountChange = (count: number) => {
    setColumnCount(count);
    setSelectedIdx(0);
  };

  const handleConfirm = () => {
    const preset = presets[selectedIdx];
    if (preset) {
      onSelect(preset.widths);
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Configure column layout</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Number of columns */}
          <div>
            <div className="text-sm font-medium text-slate-700 mb-2.5">
              Number of columns
            </div>
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  onClick={() => handleCountChange(n)}
                  className={`flex-1 py-2 text-sm font-medium rounded-md border transition-colors ${
                    columnCount === n
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Layout presets */}
          <div>
            <div className="text-sm font-medium text-slate-700 mb-2.5">
              Column layout
            </div>
            <div className="grid gap-2">
              {presets.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedIdx(idx)}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                    selectedIdx === idx
                      ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex-1">
                    <LayoutPreviewBar widths={preset.widths} />
                  </div>
                  <span className="text-xs text-slate-500 font-medium whitespace-nowrap min-w-[80px] text-right">
                    {preset.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>Add column layout</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
