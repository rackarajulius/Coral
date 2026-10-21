import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CircleCheck, Eye, Wrench } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getMyHiringCommitments, type JobRef } from '@/lib/api/employerCompany';

/** One kind of problem, with the postings that have it, each a link to fix. */
const FixList = ({ title, jobs }: { title: string; jobs: JobRef[] }) =>
  jobs.length === 0 ? null : (
    <li className="text-sm">
      <p className="font-medium text-foreground">{title}</p>
      <ul className="mt-1 flex flex-wrap gap-1.5">
        {jobs.map((j) => (
          <li key={j.id}>
            <Link
              to={`/employers/jobs/${j.id}/edit`}
              className="inline-flex rounded-full border border-border/60 px-2.5 py-0.5 text-xs text-foreground hover:bg-muted"
            >
              {j.title}
            </Link>
          </li>
        ))}
      </ul>
    </li>
  );

/**
 * The checked commitments, shown to the company they describe, with what to
 * fix. The facts come from the same service as the public company page, so
 * this isn't a private preview of a different calculation; the fix list is
 * the company's own and never shown publicly.
 */
const HiringCommitmentsCard = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['my-hiring-commitments'],
    queryFn: getMyHiringCommitments,
    retry: false,
    staleTime: 5 * 60_000,
  });

  if (isLoading) {
    return (
      <Card className="p-5 space-y-3">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-full max-w-md" />
        <Skeleton className="h-16 w-full" />
      </Card>
    );
  }
  if (!data) return null;

  const { postings, afterInterview, toFix } = data;
  const fixes =
    toFix.missingPay.length + toFix.payRangeTooWide.length + toFix.vacancyUnstated.length +
    toFix.canadianExperience.length + toFix.outcomesDueSoon + toFix.outcomesOverdue;

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Hiring commitments, checked</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Read from your postings and interviews, and shown on your company page.
          </p>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1.5 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border border-border/60 rounded-full px-3 py-1">
          <Eye className="h-3 w-3" aria-hidden="true" />
          Candidates see this
        </span>
      </div>

      {postings.open > 0 ? (
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {[
            { label: 'state pay', value: postings.withPay },
            { label: 'say if the role is open now', value: postings.vacancyStated },
            { label: 'say AI helps screen', value: postings.usingAi },
          ].map((f) => (
            <div key={f.label} className="p-3 rounded-2xl bg-muted/40 border border-border/50">
              <dt className="text-xs text-muted-foreground leading-snug">{f.label}</dt>
              <dd className="text-lg font-bold tracking-tight leading-none mt-1">
                {f.value} <span className="text-sm font-normal text-muted-foreground">of {postings.open}</span>
              </dd>
            </div>
          ))}
          <div className="p-3 rounded-2xl bg-muted/40 border border-border/50">
            <dt className="text-xs text-muted-foreground leading-snug">heard back within 45 days of an interview</dt>
            <dd className="text-lg font-bold tracking-tight leading-none mt-1">
              {afterInterview.available && afterInterview.withinDeadlineRate !== null
                ? `${afterInterview.withinDeadlineRate}%`
                : '—'}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground mt-3">No open roles right now, so there are no postings to check.</p>
      )}

      {fixes > 0 ? (
        <div className="mt-5">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Wrench className="h-4 w-4 text-amber-600 dark:text-amber-500" aria-hidden="true" />
            To fix
          </h3>
          <ul className="mt-3 space-y-3">
            <FixList title="No pay stated" jobs={toFix.missingPay} />
            <FixList title="Pay range wider than $50,000 (Ontario's limit for roles up to $200,000)" jobs={toFix.payRangeTooWide} />
            <FixList title="Doesn't say whether the role is open now" jobs={toFix.vacancyUnstated} />
            <FixList title="Asks for Canadian experience" jobs={toFix.canadianExperience} />
            {(toFix.outcomesDueSoon > 0 || toFix.outcomesOverdue > 0) && (
              <li className="text-sm">
                <p className="font-medium text-foreground">Interviewed candidates waiting for an answer</p>
                <p className="text-muted-foreground mt-0.5">
                  {toFix.outcomesOverdue > 0 && `${toFix.outcomesOverdue} past 45 days. `}
                  {toFix.outcomesDueSoon > 0 && `${toFix.outcomesDueSoon} nearing 45 days. `}
                  <Link to="/employers/candidates" className="font-medium text-primary hover:underline">
                    Share an update
                  </Link>
                </p>
              </li>
            )}
          </ul>
        </div>
      ) : (
        postings.open > 0 && (
          <p className="mt-4 flex items-center gap-2 text-sm text-foreground">
            <CircleCheck className="h-4 w-4 text-primary" aria-hidden="true" />
            Nothing to fix: every open role states what candidates need to know.
          </p>
        )
      )}

      <p className="text-xs text-muted-foreground/80 mt-4">
        Since January 2026, Ontario has required public postings by employers with 25 or more employees to state
        pay, say whether there's an existing vacancy and whether AI screens applicants, and not ask for Canadian
        experience — and interviewed candidates must hear where they stand within 45 days. Coral shows the facts; it
        doesn't certify compliance.
      </p>
    </Card>
  );
};

export default HiringCommitmentsCard;
