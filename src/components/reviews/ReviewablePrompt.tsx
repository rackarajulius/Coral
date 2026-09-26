import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getReviewable, type Reviewable } from "@/lib/api/reviews";
import LeaveReviewDialog from "./LeaveReviewDialog";

/**
 * Prompts the candidate to review hiring processes they actually went through.
 *
 * The list comes from the server, so there's no company search box: a review
 * is only possible against a real application or interview, and offering a
 * free-text picker would imply otherwise.
 *
 * Renders nothing when there's nothing to review — an empty card asking for
 * reviews you can't leave is noise on every page load.
 */
export function ReviewablePrompt({ limit = 3 }: { limit?: number }) {
  const [target, setTarget] = useState<Reviewable | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["reviewable"],
    queryFn: getReviewable,
    retry: false,
  });

  if (isLoading) return <Skeleton className="h-24 w-full rounded-2xl" />;
  if (!data || data.length === 0) return null;

  return (
    <>
      <LeaveReviewDialog
        target={target}
        open={!!target}
        onOpenChange={(o) => !o && setTarget(null)}
      />

      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <MessageSquarePlus className="h-4 w-4 text-primary" aria-hidden="true" />
          Share how these went
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Your review is anonymous to the employer and helps other candidates know what to expect.
        </p>

        <div className="mt-3 space-y-2">
          {data.slice(0, limit).map((r) => (
            <div
              key={`${r.kind}-${r.id}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{r.company}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {r.role} · {r.stageReached}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setTarget(r)}>
                Review
              </Button>
            </div>
          ))}
        </div>

        {data.length > limit && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            {data.length - limit} more you can review.
          </p>
        )}
      </div>
    </>
  );
}

export default ReviewablePrompt;
