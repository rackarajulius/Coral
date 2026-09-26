import { useQuery } from "@tanstack/react-query";
import { MailOpen, MessageSquareReply, ThumbsUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getOutreachStats } from "@/lib/api/hiring";

/**
 * How approaches are landing.
 *
 * Three rates, each with the number behind it. "Opened" means opened in Coral
 * — the email is not tracked, and the card says so rather than letting a
 * recruiter assume a candidate ignored something they may well have read in
 * their inbox.
 */
export function OutreachStatsCard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["outreach-stats"],
    queryFn: getOutreachStats,
    staleTime: 5 * 60_000,
    retry: false,
  });

  if (isLoading) {
    return (
      <Card className="p-5 space-y-3">
        <Skeleton className="h-5 w-48" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      </Card>
    );
  }

  // Someone without the capability, or the endpoint unreachable: nothing to say,
  // and an error box on an analytics page is noise.
  if (isError || !data) return null;

  if (data.sent === 0) {
    return (
      <Card className="p-5">
        <h2 className="text-base font-semibold">Outreach</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          No approaches sent in the last {data.windowDays} days. Once you reach out to candidates
          from the hiring workspace, how they answer shows up here.
        </p>
      </Card>
    );
  }

  const rate = (v: number | null) => (v === null ? "—" : `${v}%`);
  const figures = [
    { icon: MailOpen, value: rate(data.openRate), label: "opened in Coral" },
    { icon: MessageSquareReply, value: rate(data.replyRate), label: "answered" },
    { icon: ThumbsUp, value: rate(data.interestedRate), label: "of answers were a yes" },
  ];

  return (
    <Card className="p-5">
      <div>
        <h2 className="text-base font-semibold">Outreach</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.sent} sent in the last {data.windowDays} days
          {data.judged < data.sent &&
            ` · rates use the ${data.judged} older than two days, so today's haven't had a chance yet`}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {figures.map((f) => (
          <div key={f.label} className="rounded-2xl border border-border/50 bg-muted/40 p-4">
            <f.icon className="mb-2 h-4 w-4 text-primary" aria-hidden="true" />
            <p className="text-xl font-bold leading-none tracking-tight">{f.value}</p>
            <p className="mt-1.5 text-xs leading-snug text-muted-foreground">{f.label}</p>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        {data.breakdown.interested} interested · {data.breakdown.notNow} not right now ·{" "}
        {data.breakdown.notInterested} not interested · {data.breakdown.waiting} waiting.{" "}
        Email opens aren't tracked, so someone may have read an email and not answered here.
      </p>

      {/* The measured half of timing advice. Silent until it has a sample. */}
      {data.timing && (
        <p className="mt-2 text-xs text-muted-foreground">
          {data.timing.comparison ? (
            <>
              Sent in their working hours: {data.timing.comparison.inHours.replyRate}% replied (
              {data.timing.comparison.inHours.sent}). Outside them: {data.timing.comparison.outOfHours.replyRate}% (
              {data.timing.comparison.outOfHours.sent}). Their local time, from their own timezone.
            </>
          ) : (
            <>
              Send-time comparison appears after {data.timing.minSample} answered-or-settled approaches to people whose
              timezone is known — {data.timing.withTimezone} so far. Until then, suggestions use their working hours.
            </>
          )}
        </p>
      )}
    </Card>
  );
}

export default OutreachStatsCard;
