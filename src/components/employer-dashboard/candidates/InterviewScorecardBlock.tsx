import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  getEmployerInterviews, submitScorecard, getScorecard,
  type InterviewOutcome,
} from "@/lib/api/hiring";
import { PanelScorecard } from "./PanelScorecard";

const OUTCOMES: { key: InterviewOutcome; label: string }[] = [
  { key: "advancing", label: "Advancing" },
  { key: "hold", label: "On hold" },
  { key: "rejected", label: "Not moving forward" },
  { key: "hired", label: "Hire" },
];
const OUTCOME_META: Record<InterviewOutcome, { label: string; cls: string }> = {
  advancing: { label: "Advancing", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20" },
  hired: { label: "Hired", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20" },
  hold: { label: "On hold", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-500/20" },
  rejected: { label: "Not moving forward", cls: "bg-rose-500/10 text-rose-700 dark:text-rose-400 ring-rose-500/20" },
};

export function InterviewScorecardBlock({ candidateId }: { candidateId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: interviews } = useQuery({
    queryKey: ["employer-interviews"],
    queryFn: getEmployerInterviews,
    staleTime: 60_000,
  });

  // The most recent interview with this candidate that has already happened.
  const target = (interviews ?? []).find(
    (i) =>
      i.candidateId === candidateId &&
      (i.status === "completed" ||
        (i.status === "confirmed" && i.scheduledAt != null && new Date(i.scheduledAt) < new Date())),
  );
  if (!target) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <ClipboardCheck className="h-4 w-4 text-primary" /> Interview outcome
        </h4>
        {!target.outcome && (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            Log outcome
          </Button>
        )}
      </div>

      {target.outcome ? (
        <RecordedOutcome interviewId={target.id} outcome={target.outcome} outcomeNote={target.outcomeNote} />
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          You interviewed this candidate — log a scorecard and let them know where they stand.
        </p>
      )}

      {/* One card per reviewer, on the company's shared rubric. */}
      <div className="mt-4">
        <PanelScorecard interviewId={target.id} />
      </div>

      <ScorecardDialog
        open={open}
        onClose={() => setOpen(false)}
        interviewId={target.id}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["employer-interviews"] });
          setOpen(false);
        }}
      />
    </div>
  );
}

function RecordedOutcome({
  interviewId, outcome, outcomeNote,
}: { interviewId: string; outcome: InterviewOutcome; outcomeNote: string | null }) {
  const { data: card } = useQuery({
    queryKey: ["interview-scorecard", interviewId],
    queryFn: () => getScorecard(interviewId),
    staleTime: 5 * 60 * 1000,
  });
  const meta = OUTCOME_META[outcome];

  return (
    <div className="mt-3 space-y-3">
      <div className="flex items-center gap-2">
        <span className={cn("rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset", meta.cls)}>{meta.label}</span>
        <span className="text-xs text-muted-foreground">shared with the candidate</span>
      </div>
      {outcomeNote && <p className="text-sm text-foreground/80">“{outcomeNote}”</p>}

      {card?.feedback && (
        <div className="space-y-2 border-t border-border pt-3">
          {card.feedback.ratings.length > 0 && (
            <div className="space-y-1">
              {card.feedback.ratings.map((r) => (
                <div key={r.label} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{r.label}</span>
                  <span className="flex gap-0.5">
                    {[1, 2, 3, 4].map((n) => (
                      <Star key={n} className={cn("h-3 w-3", n <= r.score ? "fill-primary text-primary" : "text-muted-foreground/30")} />
                    ))}
                  </span>
                </div>
              ))}
            </div>
          )}
          {card.feedback.notes && (
            <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Private notes:</span> {card.feedback.notes}</p>
          )}
        </div>
      )}
    </div>
  );
}

function ScorecardDialog({
  open, onClose, interviewId, onSaved,
}: { open: boolean; onClose: () => void; interviewId: string; onSaved: () => void }) {
  const [outcome, setOutcome] = useState<InterviewOutcome | null>(null);
  const [outcomeNote, setOutcomeNote] = useState("");

  const saveMut = useMutation({
    // Only the decision and the note the candidate reads. The private
    // assessment is a per-reviewer scorecard now and is saved separately.
    mutationFn: () =>
      submitScorecard(interviewId, {
        outcome: outcome!,
        outcomeNote: outcomeNote.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success("Outcome shared with the candidate");
      onSaved();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Interview scorecard</DialogTitle>
          <DialogDescription>Ratings and notes stay private. The outcome and message are shared with the candidate.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Ratings, recommendation and private notes moved to PanelScorecard,
              which keeps one card per reviewer. This dialog now covers only the
              decision the candidate is told, so the two cannot overwrite each
              other. */}
          {/* Outcome — candidate-visible */}
          <div className="border-t border-border pt-3">
            <p className="text-xs font-medium text-foreground mb-1.5">Decision <span className="text-muted-foreground font-normal">— the candidate sees this</span></p>
            <div className="flex flex-wrap gap-1.5">
              {OUTCOMES.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setOutcome(o.key)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors",
                    outcome === o.key ? "bg-primary text-primary-foreground ring-primary" : "bg-background text-muted-foreground ring-border hover:bg-muted",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <Textarea
              value={outcomeNote}
              onChange={(e) => setOutcomeNote(e.target.value)}
              placeholder="Optional message to the candidate (they'll see this)…"
              className="mt-2 min-h-[70px] resize-y"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => saveMut.mutate()} disabled={!outcome || saveMut.isPending}>
            {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Share outcome
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
