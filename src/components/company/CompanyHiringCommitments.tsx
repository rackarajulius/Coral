import { useQuery } from '@tanstack/react-query';
import { Bot, CalendarCheck, CircleCheck, CircleDashed, DollarSign, DoorOpen } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmployerCompany, getCompanyHiringCommitments } from '@/lib/api/employerCompany';

interface CompanyHiringCommitmentsProps {
  company?: EmployerCompany;
}

/** One checked fact. Complete facts get the check; partial ones say how far. */
const Fact = ({
  icon: Icon,
  complete,
  children,
}: {
  icon: React.ElementType;
  complete: boolean;
  children: React.ReactNode;
}) => (
  <li className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
    <div className="h-8 w-8 rounded-lg bg-muted/60 border border-border/50 flex items-center justify-center shrink-0">
      <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
    </div>
    <p className="text-sm text-foreground leading-snug pt-1.5 flex-1">{children}</p>
    {complete ? (
      <CircleCheck className="h-4 w-4 text-primary shrink-0 mt-2" aria-label="Every role" />
    ) : (
      <CircleDashed className="h-4 w-4 text-muted-foreground shrink-0 mt-2" aria-label="Some roles" />
    )}
  </li>
);

/** "the open role", "all 3 open roles", "2 of 3 open roles". */
function onRoles(n: number, total: number): string {
  if (total === 1) return 'the open role';
  return n === total ? `all ${total} open roles` : `${n} of ${total} open roles`;
}

/** "the open role", "any of the 3 open roles": for what none of them state. */
const anyRole = (total: number) => (total === 1 ? 'the open role' : `any of the ${total} open roles`);

/**
 * Hiring commitments, checked.
 *
 * LinkedIn's Commitments are what a company says about itself. These are read
 * from the company's own postings and interview records: whether pay is
 * stated, whether a role is open now, whether AI helps screen applicants, and
 * whether interviewed candidates hear back within 45 days — what Ontario has
 * required of postings since January 2026. Nobody at the company can edit
 * them, and they are facts, never a "compliant" badge.
 *
 * Renders nothing with no open roles and too few interviews to judge.
 */
const CompanyHiringCommitments = ({ company }: CompanyHiringCommitmentsProps) => {
  const { data } = useQuery({
    queryKey: ['company-hiring-commitments', company?.id],
    queryFn: () => getCompanyHiringCommitments(company!.id),
    enabled: !!company?.id,
    staleTime: 60 * 60_000,
  });

  if (!company || !data) return null;
  const { postings, afterInterview } = data;
  if (postings.open === 0 && !afterInterview.available) return null;

  const name = company.companyName;
  const total = postings.open;

  return (
    <Card id="commitments" className="border-border/50 rounded-2xl scroll-mt-28">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Hiring commitments, checked</CardTitle>
        <p className="text-sm text-muted-foreground">
          Read by Coral from {name}'s postings and interview records. Nobody at {name} can edit these.
        </p>
      </CardHeader>

      <CardContent>
        <ul className="divide-y divide-border/50">
          {total > 0 && (
            <Fact icon={DollarSign} complete={postings.withPay === total}>
              {postings.withPay === 0
                ? `Pay isn't stated on ${anyRole(total)}.`
                : `Pay is stated on ${onRoles(postings.withPay, total)}.`}
            </Fact>
          )}

          {total > 0 && (
            <Fact icon={DoorOpen} complete={postings.vacancyStated === total}>
              {postings.vacancyStated === 0
                ? `Whether there's an opening now isn't stated on ${anyRole(total)}.`
                : `Whether there's an opening now is stated on ${onRoles(postings.vacancyStated, total)}.`}
              {postings.futureOpenings > 0 &&
                ` ${postings.futureOpenings === 1 ? 'One is' : `${postings.futureOpenings} are`} for future openings.`}
            </Fact>
          )}

          {total > 0 && (
            // Complete either way: a posting that says AI is used has kept the
            // commitment, and Coral adds the statement whenever its own AI screens.
            <Fact icon={Bot} complete>
              {postings.usingAi > 0
                ? `AI helps screen applicants for ${onRoles(postings.usingAi, total)}, as ${postings.usingAi === 1 ? 'its posting says' : 'their postings say'}.`
                : `No open role says AI is used to screen applicants. Coral adds that statement itself whenever its AI screens a role's applicants.`}
            </Fact>
          )}

          {afterInterview.available && afterInterview.withinDeadlineRate !== null && (
            <Fact icon={CalendarCheck} complete={afterInterview.withinDeadlineRate === 100}>
              {afterInterview.withinDeadlineRate}% of interviewed candidates heard where they stand within{' '}
              {afterInterview.deadlineDays} days
              {afterInterview.medianDaysToOutcome !== null &&
                `, typically ${afterInterview.medianDaysToOutcome < 1 ? 'the same day' : `after ${afterInterview.medianDaysToOutcome} ${afterInterview.medianDaysToOutcome === 1 ? 'day' : 'days'}`}`}
              . <span className="text-muted-foreground">From {afterInterview.measured.toLocaleString()} interviews.</span>
            </Fact>
          )}
        </ul>
      </CardContent>
    </Card>
  );
};

export default CompanyHiringCommitments;
