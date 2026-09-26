import { useQuery } from '@tanstack/react-query';
import { Clock, Eye, MailCheck, MessageSquareOff } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getMyHiringStats } from '@/lib/api/employerCompany';

/**
 * The responsiveness figures, shown to the company they describe.
 *
 * These are the same numbers candidates see on the public company page, from
 * the same endpoint — so this card is not a private preview of a different
 * calculation. Employers see them here first, which is what makes publishing
 * them an incentive rather than an ambush.
 *
 * Deliberately not dressed up: no target, no grade, no comparison to an
 * industry average that doesn't exist. Three measured facts and what they mean.
 */
const HiringResponsivenessCard = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['my-hiring-stats'],
    queryFn: getMyHiringStats,
    retry: false,
    staleTime: 30 * 60_000,
  });

  if (isLoading) {
    return (
      <Card className="p-5 space-y-3">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-4 w-full max-w-md" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      </Card>
    );
  }

  const months = data ? Math.round(data.windowDays / 30) : 12;

  if (!data?.available) {
    return (
      <Card className="p-5">
        <h2 className="text-base font-semibold">How candidates experience you</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Not enough applications yet to publish anything. Once there are enough to be fair
          about, these figures appear here and on your public company page: how many
          applications get an answer, how long a first reply takes, and how many people are
          left waiting. They're measured from your pipeline — nothing here is written by you
          or by us.
        </p>
      </Card>
    );
  }

  const figures = [
    data.responseRate !== null && {
      icon: MailCheck,
      value: `${data.responseRate}%`,
      label: 'of applications get an answer',
      warn: data.responseRate < 60,
    },
    data.medianDaysToFirstResponse !== null && {
      icon: Clock,
      value:
        data.medianDaysToFirstResponse < 1
          ? 'Same day'
          : `${data.medianDaysToFirstResponse} ${data.medianDaysToFirstResponse === 1 ? 'day' : 'days'}`,
      label: 'typical wait for a first reply',
      warn: data.medianDaysToFirstResponse > 14,
    },
    data.ghostedRate !== null && {
      icon: MessageSquareOff,
      value: `${data.ghostedRate}%`,
      label: 'still waiting after 30 days',
      warn: data.ghostedRate >= 25,
    },
  ].filter(Boolean) as Array<{
    icon: React.ElementType;
    value: string;
    label: string;
    warn: boolean;
  }>;

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">How candidates experience you</h2>
          <p className="text-sm text-muted-foreground mt-1">
            From {data.sampleSize.toLocaleString()} applications over the past {months} months.
          </p>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1.5 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border border-border/60 rounded-full px-3 py-1">
          <Eye className="h-3 w-3" aria-hidden="true" />
          Candidates see this
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
        {figures.map((f) => (
          <div key={f.label} className="p-4 rounded-2xl bg-muted/40 border border-border/50">
            <f.icon
              className={`h-4 w-4 mb-2 ${f.warn ? 'text-amber-600 dark:text-amber-500' : 'text-primary'}`}
              aria-hidden="true"
            />
            <p className="text-xl font-bold tracking-tight leading-none">{f.value}</p>
            <p className="text-xs text-muted-foreground mt-1.5 leading-snug">{f.label}</p>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground/80 mt-4">
        Measured from when you first move or message an applicant. Applications people
        withdrew are left out, so nobody giving up improves the figure.
      </p>
    </Card>
  );
};

export default HiringResponsivenessCard;
