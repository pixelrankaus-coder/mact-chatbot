import type { UniqueIdentifier } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { cva } from "class-variance-authority";
import { MessageSquare, Paperclip } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { ColumnId } from "./KanbanBoard";

export interface Task {
  id: UniqueIdentifier;
  columnId: ColumnId;
  title: string;
  description?: string;
  assignees?: { name: string; initials: string; avatar?: string }[];
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
  low: "bg-slate-100 text-slate-600",
  medium: "bg-amber-50 text-amber-600",
  high: "bg-red-50 text-red-600",
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

  const variants = cva(
    "bg-white border border-slate-200 rounded-xl shadow-sm cursor-grab active:cursor-grabbing",
    {
      variants: {
        dragging: {
          over: "ring-2 ring-primary opacity-30",
          overlay: "ring-2 ring-primary shadow-lg",
        },
      },
    }
  );

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={variants({
        dragging: isOverlay ? "overlay" : isDragging ? "over" : undefined,
      })}
    >
      <CardContent className="p-4">
        {/* Title */}
        <h4 className="font-semibold text-slate-900 text-sm leading-snug">
          {task.title}
        </h4>

        {/* Description */}
        {task.description && (
          <p className="mt-1.5 text-xs text-slate-500 line-clamp-2">
            {task.description}
          </p>
        )}

        {/* Assignees and Progress Row */}
        <div className="mt-4 flex items-center justify-between">
          {/* Assignees */}
          <div className="flex items-center gap-1">
            {task.assignees?.slice(0, 3).map((assignee, idx) => (
              <Avatar key={idx} className="h-7 w-7 border-2 border-white shadow-sm">
                {assignee.avatar ? (
                  <AvatarImage src={assignee.avatar} alt={assignee.name} />
                ) : null}
                <AvatarFallback className="bg-gradient-to-br from-slate-100 to-slate-200 text-[10px] font-medium text-slate-600">
                  {assignee.initials}
                </AvatarFallback>
              </Avatar>
            ))}
            {task.assignees && task.assignees.length > 3 && (
              <span className="ml-1 text-xs text-slate-400">
                +{task.assignees.length - 3}
              </span>
            )}
          </div>

          {/* Progress Circle */}
          {task.progress !== undefined && (
            <div className="flex items-center gap-1.5">
              <div className="relative h-6 w-6">
                <svg className="h-6 w-6 -rotate-90" viewBox="0 0 36 36">
                  <circle
                    cx="18"
                    cy="18"
                    r="14"
                    fill="none"
                    className="stroke-slate-100"
                    strokeWidth="3"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="14"
                    fill="none"
                    className={task.progress === 100 ? "stroke-green-500" : "stroke-slate-400"}
                    strokeWidth="3"
                    strokeDasharray={`${(task.progress / 100) * 88} 88`}
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <span className="text-xs text-slate-500">{task.progress}%</span>
            </div>
          )}
        </div>

        {/* Footer: Priority and Meta */}
        <div className="mt-3 flex items-center justify-between pt-3 border-t border-slate-100">
          {task.priority ? (
            <Badge
              variant="secondary"
              className={`text-[10px] font-medium capitalize px-2 py-0.5 ${priorityColors[task.priority]}`}
            >
              {task.priority}
            </Badge>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-3 text-slate-400">
            {task.attachments !== undefined && task.attachments > 0 && (
              <span className="flex items-center gap-1 text-xs">
                <Paperclip className="h-3.5 w-3.5" />
                {task.attachments}
              </span>
            )}
            {task.comments !== undefined && task.comments > 0 && (
              <span className="flex items-center gap-1 text-xs">
                <MessageSquare className="h-3.5 w-3.5" />
                {task.comments}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
