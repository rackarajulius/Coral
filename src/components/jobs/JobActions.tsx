import { Bookmark, Check, ExternalLink, Mail, Mic, Share, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Job } from "@/data/jobs";

/** What to offer once someone is past applying. */
export interface JobNextStep {
  /** `screening`: the employer invited them to an AI screening — the real thing. */
  kind: "practice" | "screening";
  onClick: () => void;
}

/**
 * Apply, save, share.
 *
 * One component for both layouts. This row used to be written out twice —
 * mobile and desktop — which is how the desktop card ended up missing whole
 * sections without anyone noticing.
 *
 * The apply label names the route the application actually takes, because the
 * question behind the button is "do I have to start over somewhere else?".
 * A single label for all three would answer it wrong two thirds of the time.
 *
 * Once applied, the button becomes the next useful thing — practising for the
 * interview, or the employer's screening when there is one — and "Applied"
 * moves to a line underneath, so the confirmation is never lost.
 */
export function JobActions({
  job,
  isSaved,
  applied = false,
  appliedKnown = true,
  appliedAt,
  nextStep,
  onApply,
  onToggleSave,
  onShare,
}: {
  job: Job;
  isSaved: boolean;
  /** On-platform applications only — see JobDetails for why. */
  applied?: boolean;
  /**
   * False while the person's applications are still loading. The button waits
   * rather than inviting them to apply to something they already applied to.
   */
  appliedKnown?: boolean;
  /** When they applied (ISO), shown with the confirmation. */
  appliedAt?: string | null;
  /** Shown only once applied. Null hides it (not applied, withdrawn, employers). */
  nextStep?: JobNextStep | null;
  onApply: () => void;
  onToggleSave: () => void;
  onShare?: () => void;
}) {
  const method = job.applicationMethod ?? "internal";
  const apply = APPLY_COPY[method];
  const showNext = applied && !!nextStep;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-3">
        {/* Half width, left-aligned: a full-bleed primary button made the card
            look like an advert. The size is the emphasis it needs, not more. */}
        {showNext ? (
          <Button variant="coral" className="min-w-[50%] gap-2" onClick={nextStep.onClick}>
            {nextStep.kind === "screening" ? (
              <>
                <Video className="h-4 w-4" aria-hidden="true" />
                Take your screening
              </>
            ) : (
              <>
                <Mic className="h-4 w-4" aria-hidden="true" />
                Practice for this interview
              </>
            )}
          </Button>
        ) : (
          <Button
            variant={applied ? "outline" : "coral"}
            className="w-1/2 gap-2"
            onClick={onApply}
            disabled={applied || !appliedKnown}
          >
            {applied ? (
              <>
                <Check className="h-4 w-4" aria-hidden="true" />
                Applied
              </>
            ) : (
              <>
                {apply.icon && <apply.icon className="h-4 w-4" aria-hidden="true" />}
                {apply.label}
              </>
            )}
          </Button>
        )}

        {/* `ml-auto` keeps these pinned to the right edge, where they sat when
            the apply button was full width. Halving the button moved the button,
            not them. */}
        <Button
          variant="outline"
          size="icon"
          className="ml-auto"
          onClick={onToggleSave}
          aria-label={isSaved ? "Remove from saved" : "Save job"}
        >
          <Bookmark className={cn("h-5 w-5", isSaved && "fill-current text-coral")} />
        </Button>

        <Button variant="outline" size="icon" onClick={onShare} aria-label="Share this job">
          {/* The tray-and-arrow mark, which now reads as "share" almost
              everywhere. The three-node graph it replaces reads as a diagram. */}
          <Share className="h-4 w-4" />
        </Button>
      </div>

      {showNext && (
        <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
          <Check className="h-4 w-4 text-[hsl(var(--status-active))]" aria-hidden="true" />
          <span>
            Applied{appliedAt ? ` · ${formatAppliedDate(appliedAt)}` : ""}
            {nextStep.kind === "screening" && " · You're invited to an AI screening"}
          </span>
        </p>
      )}
    </div>
  );
}

/** "17 Sep", or "17 Sep 2025" when it wasn't this year. */
function formatAppliedDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/**
 * What the button says, by route.
 *
 * `internal` is named after us rather than after the speed of it: "easy" and
 * "quick" are the incumbents' words, and they promise something about effort
 * that we would then have to keep. "Apply with Coral" says what actually
 * happens — the profile already here does the work.
 *
 * The other two lead somewhere else and say so before the click, not after.
 */
const APPLY_COPY: Record<
  "internal" | "external" | "email",
  { label: string; icon?: React.ElementType }
> = {
  internal: { label: "Apply with Coral" },
  external: { label: "Apply on their site", icon: ExternalLink },
  email: { label: "Apply by email", icon: Mail },
};

export default JobActions;
