import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CalendarPlus, Clock, ExternalLink, Loader2, MapPin, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  MODE_LABEL,
  rsvpTide,
  tideCalendarUrl,
  tideWhen,
  tideWhenYours,
  withdrawFromTide,
  type Tide,
} from "@/lib/api/tides";

/**
 * A tide, wherever it appears — in the feed inside a post, on a company page,
 * or on its own.
 *
 * The RSVP lives here rather than in the post footer on purpose: the same tide
 * can be announced in several posts, and one action bound to one record beats
 * three buttons with counts to keep in step.
 */
export function TideCard({ tide, compact = false }: { tide: Tide; compact?: boolean }) {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const canceled = !!tide.canceledAt;
  const yours = tideWhenYours(tide);

  const answer = useMutation({
    mutationFn: (next: "GOING" | null) =>
      next ? rsvpTide(tide.id, next) : withdrawFromTide(tide.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tides"] });
      void queryClient.invalidateQueries({ queryKey: ["community-posts"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const going = tide.myRsvp === "GOING";
  const full = tide.capacity != null && tide.goingCount >= tide.capacity && !going;

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4",
        canceled && "opacity-75",
        compact && "p-3",
      )}
    >
      {canceled && (
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-destructive">
          Cancelled
          {tide.cancelReason && <span className="font-normal normal-case"> — {tide.cancelReason}</span>}
        </p>
      )}

      <Link to={`/community/tides/${tide.id}`} className="block hover:underline">
        <h3 className={cn("font-semibold leading-snug", compact ? "text-sm" : "text-base")}>
          {tide.title}
        </h3>
      </Link>

      {tide.company && (
        <p className="mt-0.5 text-xs text-muted-foreground">Held by {tide.company.name}</p>
      )}

      <div className="mt-3 space-y-1.5 text-sm">
        <p className="flex items-start gap-2 text-muted-foreground">
          <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            {tideWhen(tide)}
            {/* The host's clock and the reader's are both needed: one to
                understand what was meant, the other to turn up. */}
            {yours && <span className="block text-xs">{yours} your time</span>}
          </span>
        </p>

        <p className="flex items-center gap-2 text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">
            {MODE_LABEL[tide.mode]}
            {tide.location && ` · ${tide.location}`}
          </span>
        </p>

        {tide.goingCount > 0 && (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              {tide.goingCount} going
              {tide.capacity != null && ` of ${tide.capacity}`}
            </span>
          </p>
        )}
      </div>

      {!compact && tide.description && (
        <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">
          {tide.description}
        </p>
      )}

      {!canceled && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {/* The way in, once it is time and only for people who are coming. */}
          {tide.joinUrl ? (
            <Button asChild size="sm">
              <a href={tide.joinUrl} target="_blank" rel="noopener noreferrer">
                Join now
                <ExternalLink className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </Button>
          ) : (
            <Button
              size="sm"
              variant={going ? "outline" : "default"}
              disabled={!isAuthenticated || answer.isPending || full}
              onClick={() => answer.mutate(going ? null : "GOING")}
              title={
                !isAuthenticated
                  ? "Sign in to catch this tide"
                  : full
                    ? "This tide is full"
                    : undefined
              }
            >
              {answer.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              {going ? "Going" : full ? "Full" : "Catch this tide"}
            </Button>
          )}

          {/* A plain link, so the browser downloads it the way it downloads
              anything. Works in Outlook, Google and Apple with no account
              connected — and it carries the tide's page, never the join URL. */}
          <Button asChild size="sm" variant="ghost">
            <a href={tideCalendarUrl(tide.id)} download>
              <CalendarPlus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Add to calendar
            </a>
          </Button>
        </div>
      )}

      {tide.joinOpensLater && (
        // Said rather than left blank: someone who is coming should know the
        // link exists and when to come back for it.
        <p className="mt-2 text-xs text-muted-foreground">
          You're going. The way in appears here an hour before it starts.
        </p>
      )}
    </div>
  );
}

export default TideCard;
