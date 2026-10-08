import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Flag, Loader2, MessageSquare, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  flagReview,
  getEmployerReviews,
  respondToReview,
  REVIEW_CATEGORIES,
  type CompanyReviews,
} from "@/lib/api/reviews";

const MIN_REPLY = 10;

function Stars({ score }: { score: number }) {
  return (
    <span className="flex gap-0.5" aria-label={`${score} out of 5`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={cn("h-3.5 w-3.5", s <= score ? "fill-amber-500 text-amber-500" : "text-border")}
        />
      ))}
    </span>
  );
}

function ReviewRow({ review }: { review: CompanyReviews["reviews"][number] }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState(review.response?.body ?? "");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["employer-reviews"] });

  const replyMut = useMutation({
    mutationFn: () => respondToReview(review.id, body.trim()),
    onSuccess: () => {
      toast.success("Reply published", { description: "It appears under the review publicly." });
      setOpen(false);
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["employer-review-overview"] });
    },
    onError: (e) => toast.error((e as Error).message || "Couldn't publish your reply"),
  });

  const flagMut = useMutation({
    mutationFn: () =>
      flagReview(review.id, "inaccurate", "Reported by the employer from their dashboard."),
    onSuccess: () =>
      toast.success("Reported", {
        description: "A moderator will look at it. Reporting doesn't hide the review.",
      }),
    onError: (e) => toast.error((e as Error).message || "Couldn't report"),
  });

  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Stars score={review.rating} />
            <h3 className="text-sm font-semibold text-foreground">{review.title}</h3>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {review.stageReached ? `${review.stageReached} · ` : ""}
            {review.publishedAt ? new Date(review.publishedAt).toLocaleDateString() : ""}
          </p>
        </div>
      </div>

      <p className="mt-2 whitespace-pre-line text-sm text-foreground/80">{review.body}</p>

      {review.categoryRatings && Object.keys(review.categoryRatings).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {REVIEW_CATEGORIES.map((c) => {
            const v = review.categoryRatings?.[c.key];
            if (typeof v !== "number") return null;
            return (
              <span key={c.key} className="text-[11px] text-muted-foreground">
                {c.label} <span className="font-medium text-foreground">{v}/5</span>
              </span>
            );
          })}
        </div>
      )}

      {review.response && !open && (
        <div className="mt-3 rounded-lg border-l-2 border-primary/50 bg-muted/40 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Your reply
          </p>
          <p className="mt-1 whitespace-pre-line text-sm text-foreground/80">
            {review.response.body}
          </p>
        </div>
      )}

      {open ? (
        <div className="mt-3">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Reply publicly. Address what they raised — don't try to identify who wrote it."
            className="min-h-[90px] resize-y"
            maxLength={2000}
          />
          {/* Said at the point of writing, because this is where it's tempting
              to guess who the reviewer is. */}
          <p className="mt-1 text-[11px] text-muted-foreground">
            Your reply is public and shown under the review. You can't see who wrote it, and
            guessing publicly tends to read badly to everyone else.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => replyMut.mutate()}
              disabled={body.trim().length < MIN_REPLY || replyMut.isPending}
            >
              {replyMut.isPending && (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              )}
              {review.response ? "Update reply" : "Publish reply"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <MessageSquare className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            {review.response ? "Edit reply" : "Reply"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto text-muted-foreground"
            onClick={() => flagMut.mutate()}
            disabled={flagMut.isPending}
          >
            <Flag className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Report
          </Button>
        </div>
      )}
    </article>
  );
}

/**
 * The employer's real reviews, with right of reply.
 *
 * Deliberately has no delete control. An employer can answer a review or report
 * it for moderation; removing it is a moderator's decision, and a dashboard
 * button that removed criticism would make the whole feature worthless.
 */
export function EmployerReviewList() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["employer-reviews"],
    queryFn: getEmployerReviews,
    retry: false,
  });

  if (isLoading) return <Skeleton className="h-64 w-full rounded-xl" />;
  if (isError || !data) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <p className="text-sm text-destructive">Couldn't load your reviews.</p>
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">Your reviews</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {data.total === 0
            ? "No reviews yet."
            : `${data.total} review${data.total === 1 ? "" : "s"} · ${data.averageRating}/5 average${data.total > data.reviews.length ? ` · Showing latest ${data.reviews.length}` : ""}`}
        </p>
      </div>

      {data.total === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Reviews come from people who applied or interviewed with you. They appear here as
            candidates go through your process.
          </p>
        </div>
      ) : (
        data.reviews.map((r) => <ReviewRow key={r.id} review={r} />)
      )}
    </section>
  );
}

export default EmployerReviewList;
