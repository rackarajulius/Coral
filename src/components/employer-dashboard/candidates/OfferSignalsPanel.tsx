import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Info, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getOfferSignals, type OfferDraft, type SignalTone } from "@/lib/api/ats";

const TONE_META: Record<SignalTone, { icon: typeof Info; cls: string }> = {
  caution: { icon: AlertTriangle, cls: "text-amber-600 dark:text-amber-400" },
  good: { icon: CheckCircle2, cls: "text-emerald-600 dark:text-emerald-400" },
  info: { icon: Info, cls: "text-muted-foreground" },
};
const ORDER: Record<SignalTone, number> = { caution: 0, good: 1, info: 2 };

/** Waits for typing to settle before re-checking, so each keystroke isn't a request. */
function useSettled<T>(value: T, ms = 450): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}

/**
 * What the company knows that bears on the offer being accepted.
 *
 * Facts with their numbers — "8% below the range you advertised" — and never a
 * score: a probability would end up deciding who is offered at all, and there
 * is nothing here to learn one from fairly. What was not weighed is listed too,
 * including what is never used.
 *
 * `draft` makes it check values still being typed; without it, the saved offer.
 */
export function OfferSignalsPanel({
  applicationId,
  draft,
  title = "Before you send",
}: {
  applicationId: string;
  draft?: OfferDraft;
  title?: string;
}) {
  const [showUnchecked, setShowUnchecked] = useState(false);
  const settled = useSettled(draft ? JSON.stringify(draft) : "");
  const preview = settled ? (JSON.parse(settled) as OfferDraft) : undefined;

  const query = useQuery({
    queryKey: ["offer-signals", applicationId, settled],
    queryFn: () => getOfferSignals(applicationId, preview),
    retry: false,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  if (query.isError) return null; // a nicety; the offer itself is what matters here
  const data = query.data;

  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
        {query.isFetching && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </div>

      {!data ? (
        <p className="mt-2 text-xs text-muted-foreground">Checking…</p>
      ) : (
        <>
          <ul className="mt-2 space-y-2">
            {[...data.signals]
              .sort((a, b) => ORDER[a.tone] - ORDER[b.tone])
              .map((s) => {
                const meta = TONE_META[s.tone];
                return (
                  <li key={s.id} className="flex gap-2 text-xs">
                    <meta.icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", meta.cls)} aria-hidden="true" />
                    <span>
                      <span className="font-medium text-foreground">{s.title}.</span>{" "}
                      <span className="text-muted-foreground">{s.detail}</span>
                    </span>
                  </li>
                );
              })}
          </ul>

          <p className="mt-2 text-[11px] text-muted-foreground">
            Facts from what your company can see — not a prediction, and nothing here is added up into a score.
          </p>

          <button
            type="button"
            onClick={() => setShowUnchecked((v) => !v)}
            className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
          >
            What wasn't checked ({data.notChecked.length})
            {showUnchecked ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          {showUnchecked && (
            <ul className="mt-1.5 space-y-1">
              {data.notChecked.map((n) => (
                <li key={n.id} className="text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground">{n.label}:</span> {n.why}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

export default OfferSignalsPanel;
