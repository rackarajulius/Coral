import { useState, useCallback } from "react";
import { Candidate, Stage, STAGES } from "@/data/employer/Candidates/types";
import { CandidateCard } from "./CandidateCard";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

const stageColors: Record<Stage, { bg: string; text: string; dot: string }> = {
  // The two rungs before an application exists — someone the company found and
  // someone they have written to.
  Sourced: { bg: "bg-sky-500/10", text: "text-sky-600", dot: "bg-sky-500" },
  Contacted: { bg: "bg-violet-500/10", text: "text-violet-600", dot: "bg-violet-500" },
  Applied: { bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground" },
  Screening: { bg: "bg-blue-500/10", text: "text-blue-600", dot: "bg-blue-500" },
  Interview: { bg: "bg-purple-500/10", text: "text-purple-600", dot: "bg-purple-500" },
  Offer: { bg: "bg-amber-500/10", text: "text-amber-600", dot: "bg-amber-500" },
  Hired: { bg: "bg-emerald-500/10", text: "text-emerald-600", dot: "bg-emerald-500" },
  Rejected: { bg: "bg-rose-500/10", text: "text-rose-600", dot: "bg-rose-500" },
  // Never a column — the candidate's own act, so nobody is dragged into it —
  // but a row can still carry it.
  Withdrawn: { bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground" },
};

interface KanbanBoardProps {
  candidates: Candidate[];
  onCandidateClick: (candidate: Candidate) => void;
  onStageChange: (candidateId: string, newStage: Stage) => void;
}

const KanbanBoard = ({ candidates, onCandidateClick, onStageChange }: KanbanBoardProps) => {
  const [dragOverStage, setDragOverStage] = useState<Stage | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, candidateId: string) => {
    e.dataTransfer.setData("candidateId", candidateId);
    setDraggedId(candidateId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, stage: Stage) => {
    e.preventDefault();
    setDragOverStage(stage);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, stage: Stage) => {
    e.preventDefault();
    const candidateId = e.dataTransfer.getData("candidateId");
    if (candidateId) onStageChange(candidateId, stage);
    setDragOverStage(null);
    setDraggedId(null);
  }, [onStageChange]);

  const handleDragLeave = useCallback(() => setDragOverStage(null), []);
  const handleDragEnd = useCallback(() => { setDragOverStage(null); setDraggedId(null); }, []);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-280px)]">
      {STAGES.map((stage) => {
        const stageCandidates = candidates.filter((c) => c.stage === stage);
        const colors = stageColors[stage];
        const isOver = dragOverStage === stage;

        return (
          <div
            key={stage}
            className="flex-shrink-0 w-[280px]"
            onDragOver={(e) => handleDragOver(e, stage)}
            onDrop={(e) => handleDrop(e, stage)}
            onDragLeave={handleDragLeave}
          >
            {/* Column Header */}
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <div className={cn("h-2.5 w-2.5 rounded-full", colors.dot)} />
                <h3 className="text-sm font-semibold text-foreground">{stage}</h3>
                <span className="text-xs text-muted-foreground bg-secondary rounded-full px-2 py-0.5">
                  {stageCandidates.length}
                </span>
              </div>
              <button className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Column Drop Zone */}
            <div
              className={cn(
                "space-y-3 rounded-xl p-2 min-h-[200px] transition-all duration-200",
                isOver ? "bg-primary/5 ring-2 ring-primary/20 ring-dashed" : "bg-secondary/30"
              )}
            >
              {stageCandidates.length === 0 && !isOver && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className={cn("h-10 w-10 rounded-full flex items-center justify-center mb-2", colors.bg)}>
                    <span className={cn("text-lg", colors.text)}>0</span>
                  </div>
                  <p className="text-xs text-muted-foreground">No candidates</p>
                </div>
              )}
              {stageCandidates.map((candidate) => (
                <div
                  key={candidate.id}
                  className={cn(
                    "transition-opacity duration-200",
                    draggedId === candidate.id && "opacity-40"
                  )}
                  onDragEnd={handleDragEnd}
                >
                  <CandidateCard
                    candidate={candidate}
                    onClick={() => onCandidateClick(candidate)}
                    onView={() => {}}
                    onMessage={() => {}}
                    onReject={() => {}}
                    onDragStart={(e) => handleDragStart(e, candidate.id)}
                    onDragEnd={handleDragEnd}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default KanbanBoard;
