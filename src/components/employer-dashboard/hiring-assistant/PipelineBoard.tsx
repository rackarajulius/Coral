import { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import {
  Sparkles,
  MoreHorizontal,
  Mail,
  Plus,
  GripVertical,
  CheckCircle2,
  FileCheck,
  FolderInput,
  XCircle,
  MessageSquare,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { PipelineStage, PipelineCandidate, Candidate } from "@/data/employer/HiringAssistant/Index";

// ─── Types ────────────────────────────────────────────────────────────────────

type DragListeners = ReturnType<typeof useDraggable>["listeners"];

interface PipelineBoardProps {
  stages: PipelineStage[];
  candidates: PipelineCandidate[];
  onMoveStage: (name: string, stageId: string) => void;
  onOpenOutreach: (candidate: Candidate) => void;
  onRemoveFromPipeline: (name: string) => void;
  /**
   * The other projects this candidate could be gathered into.
   *
   * Three searches for one job leave people scattered across three containers;
   * this is how a recruiter pulls them together without losing anyone's stage.
   */
  projects: { id: string; label: string }[];
  onMoveToProject: (name: string, projectId: string) => void;
  /**
   * Whether this seat may move people through the pipeline
   * (`candidates:write`).
   *
   * The server has always refused these; the board offered them anyway, so a
   * comment-only seat got a draggable board where every drag failed.
   */
  canMove: boolean;
  /**
   * Candidate ids already approached — by anyone at this company.
   *
   * Was a set of *names*, which meant two people called J. Smith shared one
   * marker and the whole thing vanished on refresh.
   */
  contactedIds?: Set<string>;
}

// ─── Drag ghost ───────────────────────────────────────────────────────────────

function DragGhostCard({ candidate }: { candidate: PipelineCandidate }) {
  return (
    <div className="w-56 rotate-1 rounded-xl border border-accent/60 bg-card p-3 shadow-elevated">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-xs font-semibold text-primary-foreground">
          {candidate.initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-foreground">{candidate.name}</p>
          <p className="truncate text-[10px] text-muted-foreground">{candidate.company}</p>
        </div>
        <div className="flex items-center gap-1 text-[11px] font-semibold text-accent">
          <Sparkles className="h-3 w-3" />
          {candidate.match}%
        </div>
      </div>
    </div>
  );
}

// ─── Mini card ────────────────────────────────────────────────────────────────

interface PipelineMiniCardProps {
  candidate: PipelineCandidate;
  stages: PipelineStage[];
  dragHandleListeners: DragListeners;
  outreached: boolean;
  onMove: (stageId: string) => void;
  onOpenOutreach: () => void;
  onRemoveFromPipeline: () => void;
  projects: { id: string; label: string }[];
  onMoveToProject: (projectId: string) => void;
  canMove: boolean;
}

function PipelineMiniCard({
  candidate,
  stages,
  dragHandleListeners,
  outreached,
  onMove,
  onOpenOutreach,
  onRemoveFromPipeline,
  projects,
  onMoveToProject,
  canMove,
}: PipelineMiniCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-card">
      {/* Header row */}
      <div className="flex items-start justify-between gap-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          {canMove && (
            <button
              type="button"
              {...dragHandleListeners}
              className="shrink-0 touch-none cursor-grab text-muted-foreground/30 transition-colors hover:text-muted-foreground active:cursor-grabbing"
              aria-label="Drag to reorder"
            >
              <GripVertical className="h-3.5 w-3.5" />
            </button>
          )}

          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-xs font-semibold text-primary-foreground">
            {candidate.initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-foreground">{candidate.name}</p>
            <p className="truncate text-[10px] text-muted-foreground">{candidate.company}</p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="shrink-0 rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Candidate options"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {/* Moving someone is a decision; a comment-only seat is offered
                the message and profile actions below instead. */}
            {canMove && (
              <>
                <p className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Move to stage
                </p>
                {stages.map((stage) => (
                  <DropdownMenuItem
                    key={stage.id}
                    onClick={() => onMove(stage.id)}
                    disabled={candidate.stageId === stage.id}
                    className="text-xs"
                  >
                    <span className={cn("mr-2 h-2 w-2 shrink-0 rounded-full", stage.dotColor)} />
                    {stage.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
              </>
            )}

            {/*
              Stage-specific actions.

              Several of these used to be toasts and nothing else — "Interview
              scheduled … Calendar invite sent to both parties", "Interview notes
              saved" — announcing work the product had not done. They are gone
              rather than reworded. Real interview scheduling lives on the
              candidates board, and notes now live on the candidate's own sheet.

              What remains are stage moves, which the board genuinely performs.
            */}
            {canMove && candidate.stageId === "CONTACTED" && (
              <>
                <DropdownMenuItem
                  className="text-xs"
                  onClick={() => {
                    onMove("SCREENING");
                    toast.success(`${candidate.name} replied — moved to Screening`);
                  }}
                >
                  <CheckCircle2 className="mr-2 h-3.5 w-3.5 text-emerald-500" />
                  Mark as replied
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs" onClick={onOpenOutreach}>
                  <MessageSquare className="mr-2 h-3.5 w-3.5" />
                  Send follow-up
                </DropdownMenuItem>
              </>
            )}

            {canMove && candidate.stageId === "OFFER" && (
              <>
                {/* Now a real move. The sourced board had no Hired stage, so
                    accepting an offer could only ever be a congratulatory
                    message that changed nothing. */}
                <DropdownMenuItem
                  className="text-xs"
                  onClick={() => {
                    onMove("HIRED");
                    toast.success(`${candidate.name} accepted — moved to Hired`);
                  }}
                >
                  <CheckCircle2 className="mr-2 h-3.5 w-3.5 text-emerald-500" />
                  Mark as accepted
                </DropdownMenuItem>
                {/* Also a real move now, and better than the old behaviour:
                    this used to delete them from the pipeline, so a declined
                    offer left no trace of ever having been made. */}
                <DropdownMenuItem
                  className="text-xs text-destructive focus:text-destructive"
                  onClick={() => {
                    onMove("REJECTED");
                    toast(`${candidate.name} declined the offer`);
                  }}
                >
                  <XCircle className="mr-2 h-3.5 w-3.5" />
                  Mark as declined
                </DropdownMenuItem>
              </>
            )}

            {/* Gathering someone into the project they belong in. Absent when
                there is nowhere else to put them. */}
            {canMove && projects.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Move to project
                </DropdownMenuLabel>
                {projects.map((p) => (
                  <DropdownMenuItem
                    key={p.id}
                    className="text-xs"
                    onClick={() => onMoveToProject(p.id)}
                  >
                    <FolderInput className="mr-2 h-3.5 w-3.5" />
                    <span className="truncate">{p.label}</span>
                  </DropdownMenuItem>
                ))}
              </>
            )}

            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-xs" onClick={onOpenOutreach}>
              <Mail className="mr-2 h-3.5 w-3.5" />
              {outreached ? "Send another message" : "Send a message"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Footer row */}
      <div className="mt-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Sparkles className="h-3 w-3 text-accent" />
            {candidate.match}%
          </div>
          {/*
            They applied. Worth saying on the card: before the two records were
            linked, the same person appeared here and on the candidates board as
            two unrelated entries, and nothing told a recruiter that the person
            they sourced had since written in.
          */}
          {candidate.applicationId && (
            <a
              href={`/employers/candidates?candidate=${candidate.applicationId}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-0.5 text-[10px] font-medium text-sky-600 underline-offset-2 hover:underline dark:text-sky-400"
              title="This candidate applied — open their application"
            >
              <FileCheck className="h-2.5 w-2.5" />
              Applied
            </a>
          )}
          {outreached && (
            <span className="flex items-center gap-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-2.5 w-2.5" />
              Sent
            </span>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground">{candidate.addedAt}</span>
      </div>
    </div>
  );
}

// ─── Draggable card wrapper ───────────────────────────────────────────────────

interface DraggableCardProps {
  candidate: PipelineCandidate;
  stages: PipelineStage[];
  outreached: boolean;
  onMove: (stageId: string) => void;
  onOpenOutreach: () => void;
  onRemoveFromPipeline: () => void;
  projects: { id: string; label: string }[];
  onMoveToProject: (projectId: string) => void;
  canMove: boolean;
}

function DraggableCard({
  candidate,
  stages,
  outreached,
  onMove,
  onOpenOutreach,
  onRemoveFromPipeline,
  projects,
  onMoveToProject,
  canMove,
}: DraggableCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: candidate.name,
  });

  return (
    <div ref={setNodeRef} {...attributes} style={{ opacity: isDragging ? 0 : 1 }}>
      <PipelineMiniCard
        candidate={candidate}
        stages={stages}
        dragHandleListeners={listeners}
        outreached={outreached}
        onMove={onMove}
        onOpenOutreach={onOpenOutreach}
        onRemoveFromPipeline={onRemoveFromPipeline}
        projects={projects}
        onMoveToProject={onMoveToProject}
        canMove={canMove}
      />
    </div>
  );
}

// ─── Droppable stage column ───────────────────────────────────────────────────

interface DroppableColumnProps {
  stage: PipelineStage;
  candidates: PipelineCandidate[];
  stages: PipelineStage[];
  contactedIds: Set<string>;
  onMoveStage: (name: string, stageId: string) => void;
  onOpenOutreach: (candidate: Candidate) => void;
  onRemoveFromPipeline: (name: string) => void;
  /**
   * The other projects this candidate could be gathered into.
   *
   * Three searches for one job leave people scattered across three containers;
   * this is how a recruiter pulls them together without losing anyone's stage.
   */
  projects: { id: string; label: string }[];
  onMoveToProject: (name: string, projectId: string) => void;
  /**
   * Whether this seat may move people through the pipeline
   * (`candidates:write`).
   *
   * The server has always refused these; the board offered them anyway, so a
   * comment-only seat got a draggable board where every drag failed.
   */
  canMove: boolean;
}

function DroppableColumn({
  stage,
  candidates,
  stages,
  contactedIds,
  onMoveStage,
  onOpenOutreach,
  onRemoveFromPipeline,
  projects,
  onMoveToProject,
  canMove,
}: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-56 shrink-0 flex-col gap-2 rounded-xl p-1 transition-colors duration-150",
        isOver && "bg-accent/5 ring-1 ring-inset ring-accent/30"
      )}
    >
      <div className="flex items-center justify-between px-1 py-0.5">
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full", stage.dotColor)} />
          <span className={cn("text-xs font-semibold", stage.textColor)}>{stage.label}</span>
        </div>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {candidates.length}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {candidates.map((c) => (
          <DraggableCard
            key={c.name}
            candidate={c}
            stages={stages}
            outreached={!!c.id && contactedIds.has(c.id)}
            onMove={(stageId) => onMoveStage(c.name, stageId)}
            projects={projects}
            onMoveToProject={(projectId) => onMoveToProject(c.name, projectId)}
            canMove={canMove}
            onOpenOutreach={() => onOpenOutreach(c)}
            onRemoveFromPipeline={() => onRemoveFromPipeline(c.name)}
          />
        ))}
        {candidates.length === 0 && (
          <div
            className={cn(
              "rounded-xl border border-dashed border-border/60 bg-muted/10 py-5 text-center transition-colors duration-150",
              isOver && "border-accent/40 bg-accent/5"
            )}
          >
            <p className="text-[11px] text-muted-foreground/60">{isOver ? "Drop here" : "Empty"}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PipelineBoard ────────────────────────────────────────────────────────────

export function PipelineBoard({
  stages,
  candidates,
  onMoveStage,
  onOpenOutreach,
  onRemoveFromPipeline,
  projects = [],
  onMoveToProject = () => {},
  canMove = true,
  contactedIds = new Set(),
}: PipelineBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragStart = ({ active }: DragStartEvent) => setActiveId(String(active.id));
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && String(active.id) !== String(over.id)) {
      onMoveStage(String(active.id), String(over.id));
    }
    setActiveId(null);
  };

  const activeCandidate = candidates.find((c) => c.name === activeId) ?? null;

  if (candidates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 py-20 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted/60">
          <Plus className="h-5 w-5 text-muted-foreground" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">No candidates in pipeline</h3>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          Go to the Candidates tab and click "Add to Pipeline" to start tracking progress.
        </p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      // No drag for a seat that cannot move anyone: dnd-kit is given no
      // listeners rather than the drop being refused after the fact.
      onDragStart={canMove ? handleDragStart : undefined}
      onDragEnd={canMove ? handleDragEnd : undefined}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="overflow-x-auto">
        <div className="flex min-w-max gap-3 pb-4">
          {stages.map((stage) => (
            <DroppableColumn
              key={stage.id}
              stage={stage}
              candidates={candidates.filter((c) => c.stageId === stage.id)}
              stages={stages}
              contactedIds={contactedIds}
              onMoveStage={onMoveStage}
              onOpenOutreach={onOpenOutreach}
              onRemoveFromPipeline={onRemoveFromPipeline}
              projects={projects}
              onMoveToProject={onMoveToProject}
              canMove={canMove}
            />
          ))}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeCandidate ? <DragGhostCard candidate={activeCandidate} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
