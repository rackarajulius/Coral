import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getOnboardingState, getVerification } from "@/lib/api/employerOnboarding";

/**
 * The way back into setup once onboarding is behind you.
 *
 * Only the company step is required to reach the dashboard, so most employers
 * arrive here with verification and their public profile still outstanding —
 * and verification is what actually gates posting a job and contacting
 * candidates. Without this card those gates return a 403 with no route through.
 *
 * Read from the same server state the onboarding page uses (same query keys, so
 * one fetch serves both) rather than a second checklist that can disagree with
 * it. Hides itself the moment nothing is left.
 */
export function FinishSetupCard() {
  const { data: state } = useQuery({
    queryKey: ["employer-onboarding"],
    queryFn: getOnboardingState,
    retry: false,
  });
  const { data: verification } = useQuery({
    queryKey: ["employer-verification"],
    queryFn: getVerification,
    retry: false,
  });

  if (!state) return null;

  const items = [
    {
      id: "company",
      label: "Company details",
      desc: "Name, industry and size.",
      done: state.steps.company,
      to: "/employers/onboarding?step=company",
    },
    {
      id: "verify",
      label: "Verify your company",
      // Stated plainly because it's the one item with a hard consequence.
      desc: "Required before you can post a job or contact candidates.",
      // The domain-verified level is enough to hire; the badge is a separate,
      // higher bar and isn't worth nagging about here.
      done: verification ? verification.canReachCandidates : true,
      to: "/employers/onboarding?step=verify",
    },
    {
      id: "publicFace",
      label: "Logo and description",
      desc: "What candidates see on every job you post.",
      done: state.steps.publicFace,
      to: "/employers/onboarding?step=publicFace",
    },
  ];

  const outstanding = items.filter((i) => !i.done);
  if (outstanding.length === 0) return null;

  const done = items.length - outstanding.length;
  const blocked = !items.find((i) => i.id === "verify")?.done;

  return (
    <section
      aria-label="Finish setting up"
      className={cn(
        "rounded-xl border p-5",
        blocked ? "border-amber-500/40 bg-amber-500/5" : "border-border bg-card",
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Finish setting up</h2>
        <p className="text-xs text-muted-foreground">
          {done} of {items.length} done
        </p>
      </div>

      <ul className="mt-3 space-y-1.5">
        {items.map((item) => (
          <li key={item.id}>
            {item.done ? (
              <div className="flex items-start gap-2.5 rounded-lg px-2 py-1.5">
                <Check
                  className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                />
                <span className="text-sm text-muted-foreground line-through">{item.label}</span>
              </div>
            ) : (
              <Link
                to={item.to}
                className="group flex items-start gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/50"
              >
                <Circle
                  className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">{item.label}</span>
                  <span className="block text-xs text-muted-foreground">{item.desc}</span>
                </span>
                <ArrowRight
                  className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default FinishSetupCard;
