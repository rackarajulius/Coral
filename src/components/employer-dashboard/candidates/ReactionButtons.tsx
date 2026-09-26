import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useMySeat } from "@/hooks/useMySeat";
import { useBoardSync } from "@/hooks/useBoardSync";
import {
  getCandidateReactions,
  setCandidateReaction,
  type CandidateReactions,
  type ReactionValue,
} from "@/lib/api/ats";

/**
 * Thumbs up or down on a candidate, for triage.
 *
 * A hiring manager working through twenty cards can say "this one" and "not this
 * one" far faster than they can write a sentence. It is not a substitute for a
 * note and nothing is computed from it — the counts are never summed into a
 * rating, because an average would launder a handful of opinions into something
 * that reads like a measurement.
 *
 * Hovering shows *who*, which is the part that actually helps: "4 up, 1 down" is
 * not useful until you know the one down was the engineer who ran the technical
 * round.
 */
export function ReactionButtons({
  candidateId,
  /** Pass the counts the board already fetched, to avoid a request per card. */
  initial,
  size = "sm",
  className,
}: {
  candidateId: string;
  initial?: CandidateReactions | null;
  size?: "sm" | "xs";
  className?: string;
}) {
  const queryClient = useQueryClient();
  const { announce } = useBoardSync();

  /** Reacting is offering an opinion, so it takes the comment capability. */
  const { can } = useMySeat();
  const mayReact = can("candidates:comment");

  const { data } = useQuery({
    queryKey: ["candidate-reactions", candidateId],
    queryFn: () => getCandidateReactions(candidateId),
    // The board already fetched these; only go asking if it did not.
    initialData: initial ?? undefined,
    enabled: !initial,
    retry: false,
  });

  const react = useMutation({
    mutationFn: (value: ReactionValue | null) => setCandidateReaction(candidateId, value),
    onSuccess: (fresh) => {
      queryClient.setQueryData(["candidate-reactions", candidateId], fresh);
      void queryClient.invalidateQueries({ queryKey: ["employer-candidates"] });
      // The rest of the team sees it without refreshing.
      announce("reactions");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const reactions = data ?? { up: 0, down: 0, upBy: [], downBy: [], mine: null };
  const box = size === "xs" ? "h-5 px-1.5 text-[10px]" : "h-6 px-2 text-[11px]";

  /** Clicking your own reaction again takes it back. */
  const toggle = (value: ReactionValue) =>
    react.mutate(reactions.mine === value ? null : value);

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Side
        icon={<ThumbsUp className="h-3 w-3" aria-hidden="true" />}
        count={reactions.up}
        names={reactions.upBy}
        chosen={reactions.mine === "UP"}
        tone="up"
        box={box}
        disabled={!mayReact || react.isPending}
        label="Thumbs up"
        onClick={() => toggle("UP")}
      />
      <Side
        icon={<ThumbsDown className="h-3 w-3" aria-hidden="true" />}
        count={reactions.down}
        names={reactions.downBy}
        chosen={reactions.mine === "DOWN"}
        tone="down"
        box={box}
        disabled={!mayReact || react.isPending}
        label="Thumbs down"
        onClick={() => toggle("DOWN")}
      />
    </div>
  );
}

function Side({
  icon,
  count,
  names,
  chosen,
  tone,
  box,
  disabled,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  count: number;
  names: string[];
  chosen: boolean;
  tone: "up" | "down";
  box: string;
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  /**
   * The title is the whole affordance for "who thought this". A tooltip
   * component would need a provider on every card; the native attribute works
   * everywhere including on a card inside a drag layer.
   */
  const who = names.length > 0 ? `${label}: ${names.join(", ")}` : label;

  return (
    <button
      type="button"
      onClick={(e) => {
        // Cards are clickable and draggable; reacting must not also open them.
        e.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      title={who}
      aria-label={who}
      aria-pressed={chosen}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border font-medium transition-colors",
        box,
        chosen && tone === "up" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        chosen && tone === "down" && "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
        !chosen && "border-border bg-card text-muted-foreground",
        !disabled && !chosen && "hover:border-foreground/20 hover:text-foreground",
        disabled && "cursor-default opacity-60",
      )}
    >
      {icon}
      {count > 0 && <span className="tabular-nums">{count}</span>}
    </button>
  );
}

export default ReactionButtons;
