import { useQuery } from "@tanstack/react-query";
import { getRoleProfile } from "@/lib/api/hiring";

/**
 * AI-generated role profile for a hiring prompt — parsed intent, qualifications
 * and a job description, all grounded in what the employer actually wrote.
 * Cached per prompt so the LLM call runs once per search.
 */
export function useRoleProfile(prompt?: string) {
  return useQuery({
    queryKey: ["hiring", "role-profile", prompt ?? ""],
    queryFn: () => getRoleProfile(prompt!),
    enabled: !!prompt && prompt.trim().length > 0,
    staleTime: 30 * 60 * 1000,
    retry: false,
  });
}
