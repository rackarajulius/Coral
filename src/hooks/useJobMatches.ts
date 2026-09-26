import { useEffect, useRef, useState } from "react";
import { matchJobs, type JobMatch } from "@/lib/api/jobs";

/**
 * AI fit scores for the jobs currently on screen, keyed by job id.
 *
 * Only the visible ids are scored (one batched call), and every id is
 * requested at most once per session — the server caches too. A missing entry
 * means "not scored yet"; an entry with `score: null` means we genuinely can't
 * judge, which the UI states plainly rather than guessing.
 */
export function useJobMatches(jobIds: string[]) {
  const [matches, setMatches] = useState<Record<string, JobMatch>>({});
  const [loading, setLoading] = useState(false);
  const requested = useRef<Set<string>>(new Set());

  useEffect(() => {
    const pending = jobIds.filter((id) => id && !requested.current.has(id));
    if (pending.length === 0) return;
    pending.forEach((id) => requested.current.add(id));

    let cancelled = false;
    setLoading(true);
    matchJobs(pending)
      .then((rows) => {
        if (cancelled) return;
        setMatches((prev) => {
          const next = { ...prev };
          for (const r of rows) next[r.jobId] = r;
          return next;
        });
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [jobIds]);

  return { matches, loading };
}
