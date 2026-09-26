import { useQuery } from "@tanstack/react-query";
import { getContactedAmong } from "@/lib/api/hiring";

/**
 * Which of the candidates on screen this company has already written to.
 *
 * The workspace used to track this in browser state, keyed by **name**: the
 * marker disappeared on refresh, and two people called J. Smith shared one. It
 * also could not know about a colleague's outreach at all, which is the case
 * that matters most — the whole point of seeing it is not to approach someone
 * twice.
 */
export function useContactedCandidates(candidateIds: (string | undefined)[]) {
  const ids = [...new Set(candidateIds.filter((id): id is string => !!id))].sort();

  const query = useQuery({
    // Sorted and deduped above, so re-ordering the board does not refetch.
    queryKey: ["hiring", "contacted", ids],
    queryFn: () => getContactedAmong(ids),
    enabled: ids.length > 0,
    staleTime: 60 * 1000,
    retry: false,
  });

  return {
    ...query,
    contacted: (candidateId?: string) => (candidateId ? !!query.data?.[candidateId] : false),
    answer: (candidateId?: string) => (candidateId ? (query.data?.[candidateId] ?? null) : null),
  };
}
