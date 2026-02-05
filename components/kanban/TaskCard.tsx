import type { UniqueIdentifier } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cva } from "class-variance-authority";
import { GripVertical, MessageSquare, Paperclip } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { ColumnId } from "./KanbanBoard";

export interface Task {
  id: UniqueIdentifier;
  columnId: ColumnId;
  title: string;
  description?: string;
  assignees?: { name: string; initials: string }[];
  progress?: number;
  priority?: "low" | "medium" | "high";
  comments?: number;
  attachments?: number;
}

interface TaskCardProps {
  task: Task;
  isOverlay?: boolean;
}

export type TaskType = "Task";

export interface TaskDragData {
  type: TaskType;
  task: Task;
}

const priorityColors = {
  low: "bg-slate-100 text-slate-600 border-slate-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  high: "bg-red-100 text-red-700 border-red-200",
};

export function TaskCard({ task, isOverlay }: TaskCardProps) {
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: {
      type: "Task",
      task,
    } satisfies TaskDragData,
    attributes: {
      roleDescription: "Task",
    },
  });

  const style = {
    transition,
    transform: CSS.Translate.toString(transform),
  };

  const variants = cva("bg-white border border-slate-200 shadow-sm", {
    variants: {
      dragging: {
        over: "ring-2 ring-primary opacity-30",
        overlay: "ring-2 ring-primary shadow-lg",
      },
    },
  });

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={variants({
        dragging: isOverlay ? "overlay" : isDragging ? "over" : undefined,
      })}
    >
      <CardContent className="p-4">
        {/* Header with grip and title */}
        <div className="flex items-start gap-2">
          <Button
            variant="ghost"
            {...attributes}
            {...listeners}
            className="p-1 text-slate-400 -ml-2 -mt-1 h-auto cursor-grab hover:text-slate-600"
          >
            <span className="sr-only">Move task</span>
            <GripVertical className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-slate-900 text-sm leading-snug">
              {task.title}
            </h4>
            {task.description && (
              <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                {task.description}
              </p>
            )}
          </div>
        </div>

        {/* Assignees and Progress */}
        <div className="mt-3 flex items-center justify-between">
          {/* Assignees */}
          <div className="flex -space-x-2">
            {task.assignees?.slice(0, 3).map((assignee, idx) => (
              <Avatar key={idx} className="h-7 w-7 border-2 border-white">
                <AvatarFallback className="bg-slate-100 text-[10px] font-medium text-slate-600">
                  {assignee.initials}
                </AvatarFallback>
              </Avatar>
            ))}
            {task.assignees && task.assignees.length > 3 && (
              <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-[10px] font-medium text-slate-600">
                +{task.assignees.length - 3}
              </div>
            )}
          </div>

          {/* Progress Circle */}
          {task.progress !== undefined && (
            <div className="relative h-8 w-8">
              <svg className="h-8 w-8 -rotate-90" viewBox="0 0 36 36">
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  className="stroke-slate-100"
                  strokeWidth="3"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  className="stroke-primary"
                  strokeWidth="3"
                  strokeDasharray={`${task.progress} 100`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-medium text-slate-600">
                {task.progress}%
              </span>
            </div>
          )}
        </div>

        {/* Footer: Priority and Meta */}
        <div className="mt-3 flex items-center justify-between border-t pt-3">
          {task.priority && (
            <Badge
              variant="outline"
              className={`text-[10px] capitalize ${priorityColors[task.priority]}`}
            >
              {task.priority}
            </Badge>
          )}
          <div className="flex items-center gap-3">
            {task.attachments !== undefined && task.attachments > 0 && (
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <Paperclip className="h-3 w-3" />
                {task.attachments}
              </span>
            )}
            {task.comments !== undefined && task.comments > 0 && (
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <MessageSquare className="h-3 w-3" />
                {task.comments}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
