import { useNavigate } from "react-router-dom";
import { Crown } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUpgradePrompt } from "@/stores/upgradePromptStore";

/**
 * What someone sees when their plan doesn't cover what they just tried.
 *
 * Three honest variants:
 * - **Not in your plan** — the feature is Premium; offer the Premium page.
 * - **Used your free allowance** — say when it comes back, and offer Premium.
 * - **Premium, at the fair-use cap** — say when it comes back. No upsell:
 *   there is nothing further to buy, and pitching one would be a lie.
 *
 * A free alternative, when the caller has one, is offered as its own button so
 * it is always the person's choice.
 */
export function UpgradeDialog() {
  const navigate = useNavigate();
  const { prompt, close } = useUpgradePrompt();

  const resets = prompt?.resetsAt
    ? new Date(prompt.resetsAt).toLocaleDateString(undefined, {
        weekday: prompt.metric === "matcher.web" ? "long" : undefined,
        day: "numeric",
        month: "long",
      })
    : null;

  const premiumAtCap = prompt?.code === "ALLOWANCE_EXHAUSTED" && prompt.tier === "premium";
  const title =
    prompt?.code === "PREMIUM_REQUIRED"
      ? "A Premium feature"
      : premiumAtCap
        ? "You've reached this period's limit"
        : "You've used your free allowance";

  return (
    <Dialog open={!!prompt} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-coral/10 text-coral">
            <Crown className="h-5 w-5" aria-hidden="true" />
          </div>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="space-y-2">
            <span className="block">{prompt?.message}</span>
            {resets && (
              <span className="block">Your allowance comes back on {resets}.</span>
            )}
            {!premiumAtCap && (
              <span className="block">
                Premium adds more AI interview practice, jobs from across the web, cover letters
                and resume tailoring.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:justify-end">
          {prompt?.alternative && (
            <Button
              variant="outline"
              onClick={() => {
                const run = prompt.alternative!.run;
                close();
                run();
              }}
            >
              {prompt.alternative.label}
            </Button>
          )}
          {premiumAtCap ? (
            <Button onClick={close}>OK</Button>
          ) : (
            <Button
              variant="coral"
              onClick={() => {
                close();
                navigate("/premium");
              }}
            >
              See Premium
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default UpgradeDialog;
