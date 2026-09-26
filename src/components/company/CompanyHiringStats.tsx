import { useQuery } from '@tanstack/react-query';
import { Clock, MailCheck, MessageSquareOff, Route } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmployerCompany, getCompanyHiringStats } from '@/lib/api/employerCompany';

interface CompanyHiringStatsProps {
  company?: EmployerCompany;
}

/** One measured number, with the plain words for what it means. */
const Figure = ({
  icon: Icon,
  value,
  label,
  tone = 'neutral',
}: {
  icon: React.ElementType;
  value: string;
  label: string;
  tone?: 'neutral' | 'warn';
}) => (
  <div className="flex items-start gap-3 p-4 rounded-2xl bg-muted/40 border border-border/50">
    <div className="h-9 w-9 rounded-xl bg-background flex items-center justify-center shrink-0 border border-border/50">
      <Icon
        className={`h-4 w-4 ${tone === 'warn' ? 'text-amber-600 dark:text-amber-500' : 'text-primary'}`}
        aria-hidden="true"
      />
    </div>
    <div className="min-w-0">
      <p className="text-xl font-bold tracking-tight text-foreground leading-none">{value}</p>
      <p className="text-xs text-muted-foreground mt-1.5 leading-snug">{label}</p>
    </div>
  </div>
);

/**
 * What applying here is actually like.
 *
 * Everything on this card is measured from the pipeline — no employer writes
 * any of it, and none of it can be edited. That is the whole point: a careers
 * page is the company describing itself, and this is the one section that
 * isn't.
 *
 * It renders nothing at all below the sample threshold. A figure built on a
 * handful of applications would be noise presented as fact, and this card is
 * only worth having if every number on it can be trusted.
 */
const CompanyHiringStats = ({ company }: CompanyHiringStatsProps) => {
  const { data } = useQuery({
    queryKey: ['company-hiring-stats', company?.id],
    queryFn: () => getCompanyHiringStats(company!.id),
    enabled: !!company?.id,
    staleTime: 60 * 60_000,
  });

  if (!company || !data?.available) return null;

  const months = Math.round(data.windowDays / 30);

  return (
    <Card id="hiring" className="border-border/50 rounded-2xl scroll-mt-28">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">What applying here is like</CardTitle>
        <p className="text-sm text-muted-foreground">
          Measured from {data.sampleSize.toLocaleString()} applications over the past {months} months.
          Nobody at {company.companyName} can edit these.
        </p>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {data.responseRate !== null && (
            <Figure
              icon={MailCheck}
              value={`${data.responseRate}%`}
              label="of applications get an answer"
            />
          )}

          {data.medianDaysToFirstResponse !== null && (
            <Figure
              icon={Clock}
              value={
                data.medianDaysToFirstResponse < 1
                  ? 'Same day'
                  : `${data.medianDaysToFirstResponse} ${data.medianDaysToFirstResponse === 1 ? 'day' : 'days'}`
              }
              label="is the typical wait for a first reply"
            />
          )}

          {data.ghostedRate !== null && (
            <Figure
              icon={MessageSquareOff}
              // The one number nobody publishes about themselves, so it gets
              // the colour that says "read this one".
              tone={data.ghostedRate >= 25 ? 'warn' : 'neutral'}
              value={`${data.ghostedRate}%`}
              label="are still waiting after 30 days"
            />
          )}
        </div>

        {data.stages.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
              <Route className="h-4 w-4 text-primary" aria-hidden="true" />
              The stages people reach here
            </h4>
            <div className="flex flex-wrap gap-2">
              {data.stages.map((s) => (
                <span
                  key={s.stage}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/60 border border-border/50 text-xs font-medium text-foreground/80"
                >
                  {s.stage}
                  <span className="text-muted-foreground font-normal">{s.count}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Said plainly rather than buried: a median drawn from few responses is
            a weaker claim than one drawn from many, and the reader should know
            which they are looking at. */}
        {data.medianDaysToFirstResponse !== null && (
          <p className="text-xs text-muted-foreground/80">
            The typical wait is the median of {data.measuredResponses.toLocaleString()} measured
            replies. Applications people withdrew are left out throughout.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default CompanyHiringStats;
