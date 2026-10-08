import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Star } from "lucide-react";
import EmployerReviewList from "@/components/employer-dashboard/reviews/EmployerReviewList";
import { Skeleton } from "@/components/ui/skeleton";
import { getEmployerReviewOverview, REVIEW_CATEGORIES } from "@/lib/api/reviews";

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">{value}</p>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

export default function Reviews() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["employer-review-overview"],
    queryFn: getEmployerReviewOverview,
    retry: false,
  });

  return (
    <main className="mx-auto w-full max-w-[1200px] space-y-8 px-6 py-10 md:px-10 md:py-12">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Employer Reviews</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Feedback from candidates who applied or interviewed with your company.
        </p>
      </header>

      {isLoading && <Skeleton className="h-64 w-full rounded-xl" />}
      {isError && (
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-destructive">
          Couldn&apos;t load your review overview.
        </div>
      )}
      {data && (
        <>
          <section aria-label="Review summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Published reviews" value={data.total.toLocaleString()} />
            <Metric label="Average rating" value={data.averageRating === null ? "—" : `${data.averageRating}/5`} />
            <Metric label="Response rate" value={data.responseRate === null ? "—" : `${data.responseRate}%`} note={`${data.responded} replied · ${data.unanswered} unanswered`} />
            <Metric label="Average response time" value={data.averageResponseHours === null ? "—" : `${data.averageResponseHours}h`} note="Time from publication to first reply" />
          </section>

          <section className="grid gap-4 lg:grid-cols-[2fr_1fr]" aria-label="Review analytics">
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-base font-semibold">Reviews by month</h2>
              <p className="mt-1 text-xs text-muted-foreground">Published reviews over the last 12 months</p>
              <div className="mt-5 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.monthly}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="month" tickFormatter={(value: string) => value.slice(5)} tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip labelFormatter={(value) => String(value)} />
                    <Bar dataKey="count" name="Reviews" fill="#f97316" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-base font-semibold">Rating distribution</h2>
              <p className="mt-1 text-xs text-muted-foreground">All published reviews</p>
              <div className="mt-5 space-y-4">
                {[...data.distribution].reverse().map(({ star, count }) => (
                  <div key={star} className="flex items-center gap-3 text-sm">
                    <span className="flex w-8 items-center gap-1 tabular-nums">{star}<Star className="h-3 w-3 fill-amber-500 text-amber-500" /></span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-amber-500" style={{ width: `${data.total ? count / data.total * 100 : 0}%` }} />
                    </div>
                    <span className="w-8 text-right tabular-nums text-muted-foreground">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5" aria-label="Hiring experience categories">
            <h2 className="text-base font-semibold">Hiring experience</h2>
            <p className="mt-1 text-xs text-muted-foreground">Average category ratings from candidates who rated each area</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {REVIEW_CATEGORIES.map(({ key, label }) => (
                <div key={key} className="rounded-lg bg-muted/40 p-4">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">
                    {data.categoryAverages[key] == null ? "—" : `${data.categoryAverages[key]}/5`}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      <EmployerReviewList />
    </main>
  );
}
