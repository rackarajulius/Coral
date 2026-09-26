import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  addScorecardCriterion,
  getInterviewScorecards,
  getScorecardCriteria,
  saveScorecard,
  type Scorecard,
  type ScorecardRecommendation,
} from "@/lib/api/ats";

const SCALE = [1, 2, 3, 4, 5];

/**
 * A borderline verdict is a real one, so it has its own value rather than being
 * forced into a yes or a no. It counts as not advancing.
 */
const RECOMMENDATIONS: { key: ScorecardRecommendation; label: string; advancing: boolean }[] = [
  { key: "STRONG_YES", label: "Strong yes", advancing: true },
  { key: "YES", label: "Yes", advancing: true },
  { key: "MAYBE", label: "Maybe", advancing: false },
  { key: "NO", label: "No", advancing: false },
  { key: "STRONG_NO", label: "Strong no", advancing: false },
];

/** Offered when a company has no rubric yet — a starting point, not a default. */
const STARTER_CRITERIA = ["Technical skills", "Communication", "Role fit", "Problem solving"];

/**
 * Panel scorecards for one interview.
 *
 * Every reviewer writes their own card and can never edit a colleague's. The
 * block this replaces stored a single blob on the interview, so on a panel the
 * second person to save silently overwrote the first — destroying exactly the
 * disagreement a panel exists to surface.
 *
 * Criteria come from the company's shared rubric rather than a list hard-coded
 * in this file, because two interviewers scoring different things cannot be
 * compared, and comparison is what makes the fairness analysis mean anything.
 */
export function PanelScorecard({ interviewId }: { interviewId: string }) {
  const queryClient = useQueryClient();

  const criteria = useQuery({
    queryKey: ["scorecard-criteria"],
    queryFn: getScorecardCriteria,
    retry: false,
  });

  const panel = useQuery({
    queryKey: ["interview-scorecards", interviewId],
    queryFn: () => getInterviewScorecards(interviewId),
    retry: false,
  });

  const mine = panel.data?.scorecards.find((c) => c.mine);
  const others = (panel.data?.scorecards ?? []).filter((c) => !c.mine && c.submittedAt);

  return (
    <div className="space-y-5">
      {criteria.isLoading || panel.isLoading ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : (
        <>
          {criteria.data?.length === 0 ? (
            <RubricSetup
              onDone={() => queryClient.invalidateQueries({ queryKey: ["scorecard-criteria"] })}
            />
          ) : (
            <MyScorecard
              interviewId={interviewId}
              criteria={(criteria.data ?? []).map((c) => c.label)}
              existing={mine}
            />
          )}

          {panel.data && panel.data.summary.submitted > 0 && (
            <PanelSummary summary={panel.data.summary} others={others} />
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------- my scorecard ------------------------------ */

function MyScorecard({
  interviewId,
  criteria,
  existing,
}: {
  interviewId: string;
  criteria: string[];
  existing?: Scorecard;
}) {
  const queryClient = useQueryClient();
  const [scores, setScores] = useState<Record<string, number>>({});
  const [rec, setRec] = useState<ScorecardRecommendation | null>(null);
  const [notes, setNotes] = useState("");

  // Seeded from the saved card so reopening shows what was written, not a
  // blank form implying nothing was recorded.
  useEffect(() => {
    if (!existing) return;
    setScores(Object.fromEntries(existing.ratings.map((r) => [r.criterion, r.score])));
    setRec(existing.recommendation);
    setNotes(existing.notes ?? "");
  }, [existing?.id]);

  const save = useMutation({
    mutationFn: (submit: boolean) =>
      saveScorecard(interviewId, {
        ratings: criteria.filter((c) => scores[c]).map((c) => ({ criterion: c, score: scores[c] })),
        recommendation: rec ?? undefined,
        notes: notes.trim() || undefined,
        submit,
      }),
    onSuccess: (_data, submit) => {
      toast.success(submit ? "Scorecard submitted" : "Draft saved");
      void queryClient.invalidateQueries({ queryKey: ["interview-scorecards", interviewId] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const submitted = !!existing?.submittedAt;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">Your scorecard</h4>
        {submitted && (
          <span className="text-xs text-muted-foreground">
            Submitted · you can still revise it
          </span>
        )}
      </div>

      <div className="mt-4 space-y-3">
        {criteria.map((c) => (
          <div key={c} className="flex items-center justify-between gap-3">
            <span className="text-sm">{c}</span>
            <div className="flex gap-1">
              {SCALE.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setScores((s) => ({ ...s, [c]: n }))}
                  aria-label={`${c}: ${n} of 5`}
                  className={cn(
                    "h-7 w-7 rounded-md border text-xs transition-colors",
                    scores[c] === n
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:border-primary/50",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Recommendation
        </p>
        <div className="flex flex-wrap gap-1.5">
          {RECOMMENDATIONS.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRec(r.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                rec === r.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-primary/50",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="What did you see? Private to your team."
        rows={3}
        maxLength={5000}
        className="mt-4 resize-none"
      />

      <div className="mt-3 flex items-center justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => save.mutate(false)}
          disabled={save.isPending}
        >
          Save draft
        </Button>
        <Button size="sm" onClick={() => save.mutate(true)} disabled={save.isPending || !rec}>
          {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
          {submitted ? "Update" : "Submit"}
        </Button>
      </div>
      {!rec && (
        <p className="mt-1.5 text-right text-xs text-muted-foreground">
          Pick a recommendation to submit.
        </p>
      )}
    </div>
  );
}

/* -------------------------------- the panel -------------------------------- */

function PanelSummary({
  summary,
  others,
}: {
  summary: { submitted: number; advancing: number; dissenting: number; meanScore: number | null };
  others: Scorecard[];
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h4 className="flex items-center gap-1.5 text-sm font-semibold">
        <Users className="h-4 w-4 text-primary" aria-hidden="true" /> The panel
      </h4>

      {/* Split, never averaged. Three yes and one strong no is a disagreement
          worth reading, and a single blended figure is how that gets buried. */}
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span>
          <span className="font-semibold">{summary.advancing}</span>{" "}
          <span className="text-muted-foreground">for advancing</span>
        </span>
        <span>
          <span className="font-semibold">{summary.dissenting}</span>{" "}
          <span className="text-muted-foreground">against or unsure</span>
        </span>
        <span className="text-muted-foreground">
          Mean score {summary.meanScore ?? "—"}
        </span>
      </div>

      {summary.dissenting > 0 && summary.advancing > 0 && (
        <p className="mt-2 text-xs text-amber-700">
          The panel disagrees. Worth reading both before deciding.
        </p>
      )}

      <div className="mt-4 space-y-3">
        {others.map((card) => (
          <div key={card.id} className="rounded-xl border border-border p-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-medium">{card.reviewerName}</span>
              {card.recommendation && (
                <span className="text-muted-foreground">
                  · {RECOMMENDATIONS.find((r) => r.key === card.recommendation)?.label}
                </span>
              )}
            </div>
            {card.ratings.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                {card.ratings.map((r) => (
                  <span key={r.criterion}>
                    {r.criterion} {r.score}/5
                  </span>
                ))}
              </div>
            )}
            {card.notes && <p className="mt-1.5 text-sm">{card.notes}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------- rubric setup ----------------------------- */

/**
 * Shown once, when a company has no criteria yet.
 *
 * The starter list is offered rather than applied: a rubric someone chose is
 * one they will actually score against, and one silently installed is one they
 * work around.
 */
function RubricSetup({ onDone }: { onDone: () => void }) {
  const [custom, setCustom] = useState("");

  const add = useMutation({
    mutationFn: (labels: string[]) =>
      Promise.all(labels.map((label, i) => addScorecardCriterion(label, i))),
    onSuccess: () => {
      setCustom("");
      onDone();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-5">
      <h4 className="text-sm font-semibold">Set up your scorecard</h4>
      <p className="mt-1 text-sm text-muted-foreground">
        Pick what your team scores every candidate on. Everyone uses the same list, which is what
        makes two interviews comparable.
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {STARTER_CRITERIA.map((c) => (
          <span key={c} className="rounded-full bg-muted px-2.5 py-1 text-xs">
            {c}
          </span>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => add.mutate(STARTER_CRITERIA)} disabled={add.isPending}>
          {add.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
          Use these
        </Button>
        <span className="text-xs text-muted-foreground">or</span>
        <Input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && custom.trim()) add.mutate([custom.trim()]);
          }}
          placeholder="Add your own"
          maxLength={60}
          className="h-8 w-44 text-xs"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => custom.trim() && add.mutate([custom.trim()])}
          disabled={!custom.trim() || add.isPending}
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>
    </div>
  );
}

export default PanelScorecard;
