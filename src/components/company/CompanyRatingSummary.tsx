import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getCompanyReviews, REVIEW_CATEGORIES } from "@/lib/api/reviews";

function StarRow({ score, size = "sm" }: { score: number; size?: "sm" | "md" }) {
  const sz = size === "md" ? "h-5 w-5" : "h-3.5 w-3.5";
  return (
    <div className="flex gap-0.5" aria-label={`${score} out of 5`}>
      {[1, 2, 3, 4, 5].map((s) => {
        const filled = score >= s;
        const half = !filled && score >= s - 0.5;
        return (
          <span key={s} className="relative inline-block">
            <Star className={cn(sz, "text-border")} />
            {(filled || half) && (
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: filled ? "100%" : "50%" }}
              >
                <Star className={cn(sz, "fill-amber-500 text-amber-500")} />
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

/**
 * Real rating summary for a company, from verified hiring-process reviews.
 *
 * Every number here is `null` rather than `0` when nothing has been rated — an
 * unrated company is not a company rated zero, and that distinction is the
 * whole difference between "no data" and "bad".
 */
export function CompanyRatingSummary({ employerId }: { employerId?: string | null }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["company-reviews", employerId],
    queryFn: () => getCompanyReviews(employerId as string),
    enabled: !!employerId,
    retry: false,
  });

  if (!employerId) return null;
  if (isLoading) return <Skeleton className="h-40 w-full rounded-xl" />;
  if (isError || !data) return null;

  // No reviews is a normal state for a new company, not an error or a zero.
  if (data.total === 0 || data.averageRating === null) {
    return (
      <div className="rounded-xl border border-dashed border-border p-6 text-center">
        <p className="text-sm font-medium text-foreground">No reviews yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Reviews come from people who actually applied or interviewed here, so they appear once
          candidates have been through the process.
        </p>
      </div>
    );
  }

  const maxCount = Math.max(...data.distribution.map((d) => d.count), 1);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="grid gap-6 sm:grid-cols-[auto_1fr]">
        <div className="text-center sm:pr-6 sm:text-left">
          <div className="text-4xl font-bold tabular-nums">{data.averageRating}</div>
          <div className="mt-1 flex justify-center sm:justify-start">
            <StarRow score={data.averageRating} size="md" />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {data.total} review{data.total === 1 ? "" : "s"} of the hiring process
          </p>
        </div>

        <div className="space-y-1">
          {[...data.distribution].reverse().map((d) => (
            <div key={d.star} className="flex items-center gap-2">
              <span className="w-3 text-xs tabular-nums text-muted-foreground">{d.star}</span>
              <Star className="h-3 w-3 shrink-0 fill-amber-500 text-amber-500" />
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-amber-500"
                  style={{ width: `${(d.count / maxCount) * 100}%` }}
                />
              </div>
              <span className="w-6 text-right text-xs tabular-nums text-muted-foreground">
                {d.count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Only categories somebody actually rated. A category nobody scored is
          omitted rather than drawn as an empty bar. */}
      {REVIEW_CATEGORIES.some((c) => data.categoryAverages[c.key] !== null) && (
        <div className="mt-5 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
          {REVIEW_CATEGORIES.map((c) => {
            const value = data.categoryAverages[c.key];
            if (value === null || value === undefined) return null;
            return (
              <div key={c.key} className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">{c.label}</span>
                <span className="flex items-center gap-2">
                  <StarRow score={value} />
                  <span className="w-6 text-right text-xs tabular-nums">{value}</span>
                </span>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-4 text-[11px] text-muted-foreground">
        Every review is tied to a real application or interview with this company.
        {data.contextHidden && ` ${data.contextNote}`}
      </p>
    </div>
  );
}

export default CompanyRatingSummary;
