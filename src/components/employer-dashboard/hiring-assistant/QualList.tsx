// components/workspace/QualList.tsx
// Draggable-style list of qualifications with inline confidence scores.

import { GripVertical, Zap, Plus, Pencil, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/employer-dashboard/hiring-assistant/Iconbutton";
import { cn } from "@/lib/utils";
import type { Qualification } from "@/data/employer/HiringAssistant/Index";

interface QualListProps {
  items: Qualification[];
  variant: "required" | "nice";
}

export function QualList({ items, variant }: QualListProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      {items.map((q, i) => (
        <div
          key={q.text}
          className={cn(
            "group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary/40",
            i !== items.length - 1 && "border-b border-border"
          )}
          style={{ animationDelay: `${i * 60}ms` }}
        >
          {/* Drag handle */}
          <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100" />

          {/* Variant badge */}
          <Badge
            variant="secondary"
            className={cn(
              "shrink-0 rounded-md px-1.5 py-0 text-[10px] font-medium",
              variant === "required"
                ? "bg-accent/10 text-accent hover:bg-accent/10"
                : "bg-secondary text-muted-foreground"
            )}
          >
            {variant === "required" ? "Required" : "Nice"}
          </Badge>

          {/* Qual text */}
          <p className="flex-1 text-sm text-foreground">{q.text}</p>

          {/* Confidence */}
          <div className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
            <Zap className="h-3 w-3 text-accent" />
            {q.confidence}%
          </div>

          {/* Hover actions */}
          <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <IconButton icon={Pencil}    label="Edit" />
            <IconButton icon={RefreshCw} label="Regenerate" />
          </div>
        </div>
      ))}

      {/* Add row */}
      <button className="flex w-full items-center justify-center gap-1.5 border-t border-border
                         py-2.5 text-xs font-medium text-muted-foreground transition-colors
                         hover:bg-secondary/40 hover:text-foreground">
        <Plus className="h-3.5 w-3.5" /> Add qualification
      </button>
    </div>
  );
}