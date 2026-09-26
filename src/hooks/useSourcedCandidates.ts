import { useQuery } from "@tanstack/react-query";
import { sourceCandidates } from "@/lib/api/hiring";
import { useSearchCriteria } from "@/stores/searchCriteriaStore";

/**
 * Real candidates sourced + AI-ranked from the talent pool for a role query,
 * narrowed by whatever the recruiter has set in the refine panel.
 *
 * Shared by the hiring copilot hook and WorkspaceMain — react-query dedupes so
 * both consumers hit one request. That only holds while both read the criteria
 * from the same store, which is why they live in one.
 */
export function useSourcedCandidates(query?: string) {
  const criteria = useSearchCriteria((s) => s.criteria);

  return useQuery({
    // The criteria are part of what was asked for, so they are part of the key.
    queryKey: ["hiring", "candidates", query ?? "", criteria],
    queryFn: () => sourceCandidates({ ...criteria, query }),
    enabled: !!query && query.trim().length > 0,
    staleTime: 5 * 60 * 1000,
  });
}
