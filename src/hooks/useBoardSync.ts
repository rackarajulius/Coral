import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import supabase from "@/lib/supabase";
import { useMySeat } from "@/hooks/useMySeat";

/** What changed. Carried so a listener can refetch narrowly rather than everything. */
export type BoardChange = "pipeline" | "reactions" | "notes" | "tags";

const QUERIES_FOR: Record<BoardChange, string[][]> = {
  pipeline: [["employer-candidates"], ["hiring", "shortlist"], ["hiring-shortlists"]],
  reactions: [["employer-candidates"], ["candidate-reactions"]],
  notes: [["candidate-notes"]],
  tags: [["employer-candidates"], ["candidate-tags"], ["tags-in-use"]],
};

/**
 * Keeps a company's candidate boards in step across the people looking at them.
 *
 * Two recruiters and a hiring manager work the same pipeline, and until now a
 * move one of them made was invisible to the others until a refresh — so two
 * people would pick up the same candidate, or argue with a board that had
 * already changed.
 *
 * **Broadcast, not `postgres_changes`.** Subscribing to table changes would put
 * candidate rows on a Realtime channel and lean entirely on RLS being right for
 * those tables to keep one company's pipeline out of another's browser. This
 * sends a **nudge that carries no data** — "pipeline changed, refetch" — so even
 * a listener who had no business on the channel would learn nothing but that a
 * board moved. It is also the pattern already used for messaging and the
 * interview room.
 *
 * The nudge is sent by whoever made the change, after the server accepted it.
 * Changes made server-side — an application arriving, a cron moving something —
 * are not announced; those still need a refresh or a poll, and pretending
 * otherwise would be worse than the honest gap.
 */
export function useBoardSync() {
  const queryClient = useQueryClient();
  const { data: seat } = useMySeat();
  const companyId = seat?.companyId ?? null;
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    // A sole operator with no company has nobody to stay in step with.
    if (!companyId) return;

    const channel = supabase.channel(`board-${companyId}`, {
      // Our own nudge would otherwise come back to us, refetching what we just
      // wrote and fighting the optimistic update.
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "changed" }, (message) => {
        const what = (message.payload as { what?: BoardChange } | undefined)?.what;
        // An unrecognised nudge refetches the pipeline: a future sender that
        // means something we do not understand yet is better answered with a
        // reload than ignored.
        for (const key of QUERIES_FOR[what as BoardChange] ?? QUERIES_FOR.pipeline) {
          void queryClient.invalidateQueries({ queryKey: key });
        }
      })
      .subscribe();

    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [companyId, queryClient]);

  /**
   * Tells the rest of the team something moved.
   *
   * Never awaited by callers and never allowed to throw: the change is already
   * saved, and a failed nudge must not present a successful move as a failure.
   * The worst case is the old behaviour — someone refreshes.
   */
  const announce = useCallback((what: BoardChange) => {
    const channel = channelRef.current;
    if (!channel) return;
    try {
      void channel.send({ type: "broadcast", event: "changed", payload: { what } });
    } catch {
      /* a board that did not sync is the old behaviour, not a failure */
    }
  }, []);

  return { announce, connected: !!companyId };
}
