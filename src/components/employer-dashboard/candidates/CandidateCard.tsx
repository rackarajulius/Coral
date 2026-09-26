import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Eye, MessageSquare, X, Sparkles, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { ReactionButtons } from "./ReactionButtons";
import type { Candidate } from "@/data/employer/Candidates/types";
import { formatRelative, matchTone } from "./candidateUtils";

interface Props {
  candidate: Candidate;
  isDragging?: boolean;
  onClick: () => void;
  onView: () => void;
  onMessage: () => void;
  onReject: () => void;
  /** False for a seat that may comment but not decide. */
  canMove?: boolean;
  // Passed straight to a draggable <div>, so React supplies the DragEvent.
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: (e: React.DragEvent) => void;
}

export function CandidateCard({
  candidate: c,
  isDragging,
  onClick,
  onView,
  onMessage,
  onReject,
  canMove = true,
  onDragStart,
  onDragEnd,
}: Props) {
  return (
    <div
      draggable={canMove}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={cn(
        "group relative cursor-pointer rounded-xl border border-border bg-card p-3 shadow-elevation-sm transition-all",
        "hover:-translate-y-0.5 hover:shadow-elevation-md hover:border-primary/30",
        isDragging && "opacity-40 rotate-1 scale-[0.98]"
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10 ring-2 ring-background">
          <AvatarFallback className="bg-primary-soft text-primary text-xs font-semibold">
            {c.initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold">{c.name}</span>
          </div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">{c.role}</div>
        </div>
        <div
          className={cn(
            "flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset tabular-nums",
            matchTone(c.matchScore)
          )}
        >
          <Sparkles className="h-3 w-3" />
          {c.matchScore}%
        </div>
      </div>

      {c.tags.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {c.tags.slice(0, 2).map((t) => (
            <Badge key={t} variant="secondary" className="border-0 bg-muted text-[10px] font-medium">
              {t}
            </Badge>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" /> {formatRelative(c.appliedDate)}
        </span>
        <span className="truncate">{c.location}</span>
      </div>

      {/* Triage, where the triage happens. Counts come with the board, so
          showing them costs no request. */}
      <div className="mt-2 flex justify-end">
        <ReactionButtons candidateId={c.applicantId ?? c.id} initial={c.reactions} size="xs" />
      </div>

      {/* Hover quick actions */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="pointer-events-none absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="secondary" className="h-7 w-7 shadow-elevation-sm" onClick={onView}>
              <Eye className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>View profile</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="secondary" className="h-7 w-7 shadow-elevation-sm" onClick={onMessage}>
              <MessageSquare className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Message</TooltipContent>
        </Tooltip>
        {/* Rejecting is a decision, and the server refuses it from a
            comment-only seat. */}
        {canMove && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="secondary"
                className="h-7 w-7 shadow-elevation-sm hover:bg-destructive hover:text-destructive-foreground"
                onClick={onReject}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reject</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
