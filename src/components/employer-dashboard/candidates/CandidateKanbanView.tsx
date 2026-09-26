import { useState } from "react";
import { cn } from "@/lib/utils";
import { CandidateCard } from "./CandidateCard";
import type { Candidate, Stage } from "@/data/employer/Candidates/types";
import { STAGES } from "@/data/employer/Candidates/types";

interface Props {
  candidates: Candidate[];
  onSelect: (c: Candidate) => void;
  onMoveTo: (id: string, stage: Stage) => void;
  onReject: (id: string) => void;
  /**
   * Whether this seat may move people through the pipeline
   * (`candidates:write`).
   *
   * The server has always refused these, but the board offered them anyway — so
   * the comment-only seat, whose whole point is contributing without deciding,
   * got a fully draggable board where every drag failed with a toast. A control
   * that cannot work is worse than an absent one: it reads as a broken product
   * rather than a boundary.
   */
  canMove?: boolean;
}

export function CandidateKanbanView({
  candidates,
  onSelect,
  onMoveTo,
  onReject,
  canMove = true,
}: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<Stage | null>(null);

  const byStage = (stage: Stage) => candidates.filter((c) => c.stage === stage);

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {STAGES.map((stage) => {
        const cards = byStage(stage);
        return (
          <div
            key={stage}
            className={cn(
              "flex w-72 shrink-0 flex-col rounded-2xl border border-border bg-muted/30 p-3 transition-colors",
              overStage === stage && draggingId && "ring-2 ring-primary/40 bg-primary-soft/20"
            )}
            onDragOver={(e) => {
              if (!canMove) return;
              e.preventDefault();
              setOverStage(stage);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverStage(null);
            }}
            onDrop={(e) => {
              if (!canMove) return;
              e.preventDefault();
              if (draggingId) onMoveTo(draggingId, stage);
              setDraggingId(null);
              setOverStage(null);
            }}
          >
            <div className="mb-3 flex items-center justify-between px-0.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {stage}
              </span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums">
                {cards.length}
              </span>
            </div>

            <div className="flex min-h-[80px] flex-col gap-2">
              {cards.map((c) => (
                <CandidateCard
                  key={c.id}
                  candidate={c}
                  isDragging={draggingId === c.id}
                  onClick={() => onSelect(c)}
                  onView={() => onSelect(c)}
                  onMessage={() => onSelect(c)}
                  canMove={canMove}
                  onReject={() => onReject(c.id)}
                  onDragStart={() => canMove && setDraggingId(c.id)}
                  onDragEnd={() => { setDraggingId(null); setOverStage(null); }}
                />
              ))}

              {cards.length === 0 && (
                <div
                  className={cn(
                    "flex flex-1 items-center justify-center rounded-xl border-2 border-dashed border-border py-6 text-xs text-muted-foreground transition-colors",
                    overStage === stage && draggingId && "border-primary/40 text-primary"
                  )}
                >
                  {canMove ? "Drop here" : "Nobody here yet"}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
