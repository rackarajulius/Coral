import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, ChevronDown, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getCompanyReviews, REVIEW_CATEGORIES, type CompanyReviews as Data } from "@/lib/api/reviews";

const PAGE_SIZE = 5;
type SortBy = "recent" | "highest" | "lowest";

function StarRow({ score }: { score: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${score} out of 5`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={cn(
            "h-3.5 w-3.5",
            s <= score ? "fill-amber-500 text-amber-500" : "text-border",
          )}
        />
      ))}
    </div>
  );
}

/**
 * Published reviews of a company's hiring process.
 *
 * Shares its query key with CompanyRatingSummary, so the aggregate above and
 * the list below are always describing the same fetch rather than two that
 * could disagree.
 *
 * Nothing here identifies a reviewer: the API never sends an author, and
 * `stageReached` arrives as null while the company has too few reviews for it
 * to be safe to show.
 */
const CompanyReviews = ({ employerId }: { employerId?: string | null }) => {
  const [sortBy, setSortBy] = useState<SortBy>("recent");
  const [shown, setShown] = useState(PAGE_SIZE);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["company-reviews", employerId],
    queryFn: () => getCompanyReviews(employerId as string),
    enabled: !!employerId,
    retry: false,
  });

  const reviews = useMemo(() => {
    const list = [...(data?.reviews ?? [])];
    if (sortBy === "highest") list.sort((a, b) => b.rating - a.rating);
    else if (sortBy === "lowest") list.sort((a, b) => a.rating - b.rating);
    // 'recent' is the order the API already returns.
    return list;
  }, [data, sortBy]);

  if (!employerId) return null;
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>
    );
  }
  // The summary above already says "no reviews yet" — don't say it twice.
  if (isError || !data || data.total === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">What candidates said</h2>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
          <SelectTrigger className="h-8 w-[150px] text-xs" aria-label="Sort reviews">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Most recent</SelectItem>
            <SelectItem value="highest">Highest rated</SelectItem>
            <SelectItem value="lowest">Lowest rated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4 space-y-4">
        {reviews.slice(0, shown).map((r) => (
          <article key={r.id} className="rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <StarRow score={r.rating} />
                <h3 className="text-sm font-semibold text-foreground">{r.title}</h3>
              </div>
              <span className="text-[11px] text-muted-foreground">
                {r.publishedAt ? new Date(r.publishedAt).toLocaleDateString() : ""}
              </span>
            </div>

            {/* Null while the company has too few reviews to show it safely. */}
            {r.stageReached && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Reached: {r.stageReached}
              </p>
            )}

            <p className="mt-2 whitespace-pre-line text-sm text-foreground/80">{r.body}</p>

            {r.categoryRatings && Object.keys(r.categoryRatings).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                {REVIEW_CATEGORIES.map((c) => {
                  const v = r.categoryRatings?.[c.key];
                  if (typeof v !== "number") return null;
                  return (
                    <span
                      key={c.key}
                      className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
                    >
                      {c.label}
                      <span className="font-medium tabular-nums text-foreground">{v}/5</span>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Right of reply. The employer can answer but never remove. */}
            {r.response && (
              <div className="mt-3 rounded-lg border-l-2 border-primary/50 bg-muted/40 p-3">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Building2 className="h-3 w-3" aria-hidden="true" />
                  Response from the company
                </p>
                <p className="mt-1 whitespace-pre-line text-sm text-foreground/80">
                  {r.response.body}
                </p>
              </div>
            )}
          </article>
        ))}
      </div>

      {shown < reviews.length && (
        <Button
          variant="outline"
          className="mt-4 w-full"
          onClick={() => setShown((n) => n + PAGE_SIZE)}
        >
          Show {Math.min(PAGE_SIZE, reviews.length - shown)} more
          <ChevronDown className="ml-1 h-4 w-4" aria-hidden="true" />
        </Button>
      )}

      <p className="mt-4 text-[11px] text-muted-foreground">
        Reviews cover the hiring process only, and each one is tied to a real application or
        interview. Companies can reply but cannot edit or remove them.
      </p>
    </div>
  );
};

export type { Data as CompanyReviewsData };
export default CompanyReviews;
