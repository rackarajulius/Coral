import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getOfferOutcomes } from "@/lib/api/ats";

/** Readable names for the signal ids the outcomes are grouped by. */
const SIGNAL_LABELS: Record<string, string> = {
  below_posted_range: "Below the advertised range",
  within_posted_range: "Within the advertised range",
  above_posted_range: "Above the advertised range",
  below_market: "Below similar roles on Coral",
  above_market: "Above similar roles on Coral",
  in_line_with_market: "In line with similar roles",
  below_expectation: "Below the salary they shared",
  meets_expectation: "Meets the salary they shared",
  slow_process: "Longer than your usual process",
  time_in_process: "Usual process length",
  interviewed: "Took part in interviews",
  declined_interview: "Declined an interview proposal",
  unanswered_message: "Your last message unanswered",
  recently_in_touch: "Recently in touch",
  no_start_date: "No start date",
  short_notice_start: "Start date left little notice",
  deadline_window: "Had a deadline",
};

/**
 * What happened to your offers, by the facts they went out with.
 *
 * The learning half of offer signals. It says nothing until there is enough to
 * say it honestly — one declined offer is a person's decision, not a pattern.
 */
export function OfferOutcomesCard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["offer-outcomes"],
    queryFn: getOfferOutcomes,
    staleTime: 5 * 60_000,
    retry: false,
  });

  if (isLoading) return <Skeleton className="h-28 rounded-xl" />;
  if (isError || !data) return null;

  const compared = data.bySignal.filter((s) => s.withSignal.acceptanceRate !== null);

  return (
    <Card className="p-5">
      <h2 className="text-base font-semibold">Offer outcomes</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {data.decided === 0
          ? "No offers have been answered yet. Once they are, this shows how often they're accepted — and whether the facts an offer went out with made a difference."
          : `${data.accepted} of ${data.decided} answered offers accepted in the last ${Math.round(data.windowDays / 30)} months${
              data.acceptanceRate !== null ? ` (${data.acceptanceRate}%)` : ""
            }.`}
      </p>

      {compared.length > 0 ? (
        <ul className="mt-3 space-y-1.5 text-sm">
          {compared.map((s) => (
            <li key={s.id} className="flex flex-wrap items-baseline justify-between gap-x-4">
              <span className="font-medium">{SIGNAL_LABELS[s.id] ?? s.id}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {s.withSignal.acceptanceRate}% accepted with it ({s.withSignal.decided}) · {s.without.acceptanceRate}% without (
                {s.without.decided})
              </span>
            </li>
          ))}
        </ul>
      ) : (
        data.decided > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Comparisons appear once a signal has at least {data.minGroup} answered offers with it and {data.minGroup}{" "}
            without.
          </p>
        )
      )}

      {data.note && <p className="mt-2 text-xs text-muted-foreground">{data.note}</p>}
      <p className="mt-2 text-[11px] text-muted-foreground">
        Expired offers count as not accepted; ones you withdrew are left out. A difference here is worth looking into,
        not proof of a cause.
      </p>
    </Card>
  );
}

export default OfferOutcomesCard;
