import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Bot, Check, Flag, Loader2, Star, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  FLAG_REASONS,
  getModerationQueue,
  moderateReview,
  type QueuedReview,
} from "@/lib/api/reviews";

function ReviewCard({ review }: { review: QueuedReview }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");

  const mut = useMutation({
    mutationFn: (action: "publish" | "remove") =>
      moderateReview(review.id, action, note.trim() || undefined),
    onSuccess: (_d, action) => {
      toast.success(action === "publish" ? "Published" : "Removed", {
        description: "The author has been told.",
      });
      queryClient.invalidateQueries({ queryKey: ["review-moderation-queue"] });
    },
    onError: (e) => toast.error((e as Error).message || "Couldn't update"),
  });

  const checks = review.checkResults;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={cn(
                    "h-3.5 w-3.5",
                    s <= review.rating ? "fill-amber-500 text-amber-500" : "text-border",
                  )}
                />
              ))}
            </span>
            <h3 className="text-sm font-semibold text-foreground">{review.title}</h3>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {review.company} · {review.stageReached} ·{" "}
            {new Date(review.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      <p className="mt-3 whitespace-pre-line rounded-lg bg-muted/40 p-3 text-sm text-foreground/85">
        {review.body}
      </p>

      {/* Why it's here. Without this the moderator is re-reading the whole
          review to guess what the checks objected to. */}
      {checks && checks.findings.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
            <Bot className="h-3.5 w-3.5" aria-hidden="true" /> Held because
          </p>
          <ul className="mt-1.5 space-y-1 text-sm text-foreground/80">
            {checks.findings.map((f, i) => (
              <li key={i}>
                • {f.detail}{" "}
                <span className="text-[11px] text-muted-foreground">({f.code})</span>
              </li>
            ))}
          </ul>
          {!checks.aiChecked && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              The AI pass did not run — this was queued out of caution, not because a model
              objected.
            </p>
          )}
        </div>
      )}

      {review.flags && review.flags.length > 0 && (
        <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-400">
            <Flag className="h-3.5 w-3.5" aria-hidden="true" /> Reported {review.flags.length}×
          </p>
          <ul className="mt-1.5 space-y-1 text-sm text-foreground/80">
            {review.flags.map((f, i) => (
              <li key={i}>
                • {FLAG_REASONS[f.reason] ?? f.reason}
                {f.detail && <span className="text-muted-foreground"> — {f.detail}</span>}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-muted-foreground">
            A report is not a verdict. Employers flag reviews they disagree with as well as ones
            that break the rules.
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note to the author (optional, but kind when removing)"
          className="h-9 flex-1 min-w-[220px] text-sm"
          maxLength={1000}
        />
        <Button size="sm" onClick={() => mut.mutate("publish")} disabled={mut.isPending}>
          {mut.isPending ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Check className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
          )}
          Publish
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
          onClick={() => mut.mutate("remove")}
          disabled={mut.isPending}
        >
          <X className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> Remove
        </Button>
      </div>
    </div>
  );
}

/**
 * Review moderation queue.
 *
 * Two lists, kept apart on purpose: reviews the automated checks would not
 * publish, and published reviews someone has reported. They need different
 * judgement — the first is "should this go live", the second is "was letting
 * this go live wrong", and merging them invites treating a report as proof.
 */
export default function ReviewModeration() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["review-moderation-queue"],
    queryFn: getModerationQueue,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-56 rounded-xl" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return <p className="p-6 text-sm text-destructive">Couldn't load the moderation queue.</p>;
  }

  const nothing = data.pending.length === 0 && data.flagged.length === 0;

  return (
    <div className="mx-auto w-full max-w-[900px] space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Review moderation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Reviews of employers' hiring processes. Criticism is not a reason to remove — only
          personal details, named individuals, abuse, or unverifiable allegations of illegality.
        </p>
      </div>

      {nothing ? (
        <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Nothing waiting. Reviews that pass the automated checks publish on their own.
        </p>
      ) : (
        <>
          {data.pending.length > 0 && (
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Bot className="h-4 w-4 text-amber-500" aria-hidden="true" />
                Held for review ({data.pending.length})
              </h2>
              {data.pending.map((r) => (
                <ReviewCard key={r.id} review={r} />
              ))}
            </section>
          )}

          {data.flagged.length > 0 && (
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <AlertTriangle className="h-4 w-4 text-rose-500" aria-hidden="true" />
                Published but reported ({data.flagged.length})
              </h2>
              {data.flagged.map((r) => (
                <ReviewCard key={r.id} review={r} />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
