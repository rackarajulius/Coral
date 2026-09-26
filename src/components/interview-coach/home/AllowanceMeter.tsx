import { useQuery } from "@tanstack/react-query";
import { getMyEntitlements, metricOf } from "@/lib/api/entitlements";

/**
 * How many coach sessions are left this month.
 *
 * Says only what is true. While Premium isn't being charged for, nothing is
 * refused, so the line reports usage without implying a wall: "1 of 2 this
 * month (not enforced yet)". Once enforcement is on it reads as a real
 * allowance with its reset date. Premium accounts see nothing — a fair-use cap
 * isn't something to put in front of someone paying.
 *
 * Renders nothing until the numbers arrive, and nothing at all if they can't
 * be loaded: a missing meter is better than a wrong one.
 */
export default function AllowanceMeter() {
  const { data } = useQuery({
    queryKey: ["entitlements"],
    queryFn: getMyEntitlements,
    // Refetched on every visit: you usually arrive here straight from a
    // session that just used one, and a stale count would be wrong by one.
    staleTime: 0,
    retry: false,
  });

  const coach = metricOf(data, "coach.session");
  if (!data || !coach || data.tier === "premium" || coach.limit === null) return null;

  const left = Math.max(coach.limit - coach.used, 0);
  const resets = coach.resetsAt
    ? new Date(coach.resetsAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : null;

  return (
    <p className="mt-4 text-xs text-ink-dim" aria-live="polite">
      {data.enforced ? (
        <>
          {left === 0
            ? "You've used this month's free AI interviews"
            : `${left} of ${coach.limit} free AI interview${coach.limit === 1 ? "" : "s"} left this month`}
          {resets && ` · resets ${resets}`}
        </>
      ) : (
        <>
          {coach.used} of {coach.limit} free AI interviews used this month · limits aren't applied yet
        </>
      )}
    </p>
  );
}
