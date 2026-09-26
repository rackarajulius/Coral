import { useQuery } from "@tanstack/react-query";
import { getMySeat } from "@/lib/api/companyTeam";

/**
 * What the signed-in employer may do, so the UI can offer only what the server
 * will accept.
 *
 * A control that always fails is worse than an absent one: it reads as a broken
 * product rather than as a boundary. This exists because the interviewer seat
 * can comment on a candidate but not tag them, and both controls live in the
 * same panel.
 *
 * Cached for the session — a seat changes when someone's role is changed, which
 * is rare and already forces a reload elsewhere.
 */
export function useMySeat() {
  const query = useQuery({
    queryKey: ["company", "my-seat"],
    queryFn: getMySeat,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  /**
   * Unknown seats are treated as permitted.
   *
   * While this is loading, or if the request failed, hiding controls would
   * silently strip a recruiter of their own tools on a slow connection. The
   * server is the thing actually enforcing this; the UI is only being tidy.
   */
  const can = (capability: string): boolean =>
    query.data ? query.data.capabilities.includes(capability) : true;

  return { ...query, can };
}
