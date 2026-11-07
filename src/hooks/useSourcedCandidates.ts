import { useQuery } from "@tanstack/react-query";
import { sourceCandidates } from "@/lib/api/hiring";
import { useSearchCriteria } from "@/stores/searchCriteriaStore";
import type { ParsedIntent } from "@/data/employer/HiringAssistant/Index";

/**
 * Real candidates sourced + AI-ranked from the talent pool for a role query,
 * narrowed by whatever the recruiter has set in the refine panel.
 *
 * Shared by the hiring copilot hook and WorkspaceMain — react-query dedupes so
 * both consumers hit one request. That only holds while both read the criteria
 * from the same store, which is why they live in one.
 *
 * Takes the whole intent rather than its text: a "find similar" search leaves
 * out the person it started from, and both consumers must agree on that too.
 */
export function useSourcedCandidates(intent?: Pick<ParsedIntent, "raw" | "similarTo"> | null) {
  const criteria = useSearchCriteria((s) => s.criteria);
  const query = intent?.raw;
  const excludeId = intent?.similarTo?.id;

  return useQuery({
    // The criteria are part of what was asked for, so they are part of the key.
    queryKey: ["hiring", "candidates", query ?? "", criteria, excludeId ?? null],
    queryFn: () =>
      sourceCandidates({ ...criteria, query, excludeIds: excludeId ? [excludeId] : undefined }),
    enabled: !!query && query.trim().length > 0,
    staleTime: 5 * 60 * 1000,
  });
}
