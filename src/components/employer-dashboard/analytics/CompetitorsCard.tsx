import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCompetitors, type CompetitorRole } from "@/lib/api/employerAnalytics";
import { timeAgo } from "@/lib/timeAgo";

/** Whole units, compact ("$120K"). Falls back to a bare number for an unknown currency code. */
function money(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    return `${value.toLocaleString()} ${currency}`;
  }
}

function PayCell({ pay }: { pay: CompetitorRole["pay"] }) {
  if (pay.median === null) {
    return (
      <span className="text-muted-foreground">
        {pay.period === null
          ? "No pay period on your post"
          : pay.samples === 0
          ? "—"
          : `${pay.samples} comparable — too few`}
      </span>
    );
  }
  return (
    <span>
      {money(pay.median, pay.currency)}
      <span className="text-muted-foreground"> / {pay.period} · {pay.samples} posts</span>
    </span>
  );
}

/**
 * Who else on Coral is hiring for roles like yours.
 *
 * Replaces a radar of invented "industry" and "competitor" scores. Everything
 * here is a count of live posts on this platform, and each company shows why
 * its posts counted, so a recruiter can check the match rather than trust it.
 */
export function CompetitorsCard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["employer-analytics-competitors"],
    queryFn: getCompetitors,
    staleTime: 10 * 60_000,
    retry: false,
  });

  if (isLoading) {
    return (
      <Card className="p-5 space-y-3">
        <Skeleton className="h-5 w-56" />
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card className="p-5">
        <h2 className="text-base font-semibold">Companies hiring similar roles</h2>
        <p className="mt-2 text-sm text-muted-foreground">Couldn't load competitor activity.</p>
      </Card>
    );
  }

  if (data.summary.rolesCompared === 0) {
    return (
      <Card className="p-5">
        <h2 className="text-base font-semibold">Companies hiring similar roles</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Publish a job to see which other companies on Coral are hiring for the same kind of role.
        </p>
      </Card>
    );
  }

  const hasPay = data.roles.some((r) => r.pay.samples > 0);

  return (
    <div className="grid gap-6">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">Companies hiring similar roles</h2>
            <p className="text-xs text-muted-foreground">{data.note}</p>
          </div>
          <Badge variant="outline" className="text-[11px] tabular-nums">
            {data.summary.companies} {data.summary.companies === 1 ? "company" : "companies"} ·{" "}
            {data.summary.jobs} live {data.summary.jobs === 1 ? "post" : "posts"}
          </Badge>
        </div>

        {data.companies.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No other company on Coral has a live post like your {data.summary.rolesCompared}{" "}
            {data.summary.rolesCompared === 1 ? "role" : "roles"} right now.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {data.companies.map((c) => (
              <li key={`${c.name}-${c.profileId ?? ""}`} className="rounded-lg border border-border p-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/40">
                    {c.logo ? (
                      <img src={c.logo} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      {c.profileId ? (
                        <Link to={`/company-profile/${c.profileId}`} className="truncate text-sm font-medium hover:underline">
                          {c.name}
                        </Link>
                      ) : (
                        <span className="truncate text-sm font-medium">{c.name}</span>
                      )}
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {c.similarJobs} similar {c.similarJobs === 1 ? "post" : "posts"} · latest{" "}
                        {timeAgo(c.latestPostedAt)}
                      </span>
                    </div>
                    <ul className="mt-1.5 space-y-0.5">
                      {c.examples.map((e) => (
                        <li key={e.jobId} className="text-xs text-muted-foreground">
                          <Link to={`/jobs?job=${e.jobId}`} className="text-foreground hover:underline">
                            {e.title}
                          </Link>
                          {e.location ? ` · ${e.location}` : ""} — {e.reason.toLowerCase()} as your “{e.similarTo}”
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="text-base font-semibold">Your roles against the field</h2>
        <p className="text-xs text-muted-foreground">
          {hasPay
            ? "Pay compares only posts in the same currency and pay period as yours; a median needs at least three."
            : "How many other companies on Coral are hiring for each of your live roles."}
        </p>
        <div className="mt-3 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/40">
                <TableHead>Your role</TableHead>
                <TableHead className="text-right">Companies</TableHead>
                <TableHead className="text-right">Similar posts</TableHead>
                <TableHead className="text-right">Your pay</TableHead>
                <TableHead className="text-right">Similar posts' median</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.roles.map((r) => (
                <TableRow key={r.jobId}>
                  <TableCell className="font-medium">{r.title}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.competingCompanies}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.competingJobs}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.pay.yours === null ? (
                      <span className="text-muted-foreground">Not posted</span>
                    ) : (
                      money(r.pay.yours, r.pay.currency)
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <PayCell pay={r.pay} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

export default CompetitorsCard;
