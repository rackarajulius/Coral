import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMyEntitlements, metricOf } from "@/lib/api/entitlements";
import { useUpgradePrompt } from "@/stores/upgradePromptStore";
import { useInterviewSetupStore } from "@/stores/interviewSetupStore";

/**
 * Checks the AI-interview allowance before the setup wizard opens, not at its
 * last step — finding out there wastes the whole setup. The server still
 * decides; this only lets the answer arrive first. When the allowance is
 * unknown (still loading, or the check failed) the wizard just opens.
 *
 * `guard(open)` runs `open` when a run is allowed, and otherwise shows the
 * upgrade dialog with the free scripted interviewer as the alternative.
 */
export function useCoachAllowanceGate() {
  const openModal = useInterviewSetupStore((s) => s.openModal);
  const showUpgrade = useUpgradePrompt((s) => s.show);
  const { data: entitlements } = useQuery({
    queryKey: ["entitlements"],
    queryFn: getMyEntitlements,
    staleTime: 0,
    retry: false,
  });

  const guard = useCallback(
    (open: () => void) => {
      const coach = metricOf(entitlements, "coach.session");
      if (entitlements?.enforced && coach && !coach.allowed && coach.reason) {
        showUpgrade({
          code: coach.reason,
          metric: "coach.session",
          tier: entitlements.tier,
          resetsAt: coach.resetsAt,
          message:
            entitlements.tier === "premium"
              ? "You've reached this month's fair-use limit for AI interviews."
              : "You've used this month's free AI interviews.",
          alternative: {
            label: "Practice with the basic interviewer",
            run: () => openModal({ offlinePractice: true }),
          },
        });
        return;
      }
      open();
    },
    [entitlements, showUpgrade, openModal],
  );

  return { guard, entitlements };
}
