import { SortableContext, useSortable } from "@dnd-kit/sortable";
import { useDndContext, type UniqueIdentifier } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useMemo } from "react";
import { Task, TaskCard } from "./TaskCard";
import { cva } from "class-variance-authority";
import { GripVertical, Plus, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface Column {
  id: UniqueIdentifier;
  title: string;
}

export type ColumnType = "Column";

export interface ColumnDragData {
  type: ColumnType;
  column: Column;
}

interface BoardColumnProps {
  column: Column;
  tasks: Task[];
  isOverlay?: boolean;
}

export function BoardColumn({ column, tasks, isOverlay }: BoardColumnProps) {
  const tasksIds = useMemo(() => {
    return tasks.map((task) => task.id);
  }, [tasks]);

  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: column.id,
    data: {
      type: "Column",
      column,
    } satisfies ColumnDragData,
    attributes: {
      roleDescription: `Column: ${column.title}`,
    },
  });

  const style = {
    transition,
    transform: CSS.Translate.toString(transform),
  };

  const variants = cva(
    "w-[340px] min-w-[340px] bg-slate-50/80 flex flex-col rounded-xl border border-slate-200/50",
    {
      variants: {
        dragging: {
          default: "",
          over: "ring-2 ring-primary opacity-30",
          overlay: "ring-2 ring-primary shadow-lg",
        },
      },
    }
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={variants({
        dragging: isOverlay ? "overlay" : isDragging ? "over" : undefined,
      })}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between p-4 pb-2">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 cursor-grab text-slate-400 hover:text-slate-600"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </Button>
          <h3 className="font-semibold text-slate-700">{column.title}</h3>
          <Badge variant="secondary" className="rounded-md h-5 px-1.5 text-xs font-medium bg-slate-200/80 text-slate-600">
            {tasks.length}
          </Badge>
        </div>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-600">
            <Plus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-600">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tasks */}
      <div className="flex-1 overflow-y-auto p-2 pt-0">
        <div className="flex flex-col gap-3">
          <SortableContext items={tasksIds}>
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </SortableContext>
        </div>
      </div>
    </div>
  );
}

export function BoardContainer({ children }: { children: React.ReactNode }) {
  const dndContext = useDndContext();

  const variations = cva("flex gap-4 h-full", {
    variants: {
      dragging: {
        default: "snap-x snap-mandatory",
        active: "snap-none",
      },
    },
  });

  return (
    <div
      className={variations({
        dragging: dndContext.active ? "active" : "default",
      })}
    >
      {children}
    </div>
  );
}
