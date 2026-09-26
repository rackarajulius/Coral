import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { unvotePoll, votePoll, type PostPoll } from "@/lib/api/community";

/**
 * A poll on a post.
 *
 * Results stay hidden until you vote or the poll closes — the server sends
 * `count: null` until then, and this renders that absence rather than filling
 * it with a zero. Seeing the tally first is what turns a poll into a bandwagon.
 */
export function PollCard({ poll: initial }: { poll: PostPoll }) {
  const { user } = useAuth();
  const [poll, setPoll] = useState(initial);

  const cast = useMutation({
    mutationFn: (optionId: string) =>
      // Tapping your existing choice withdraws it, which also hides the
      // results again — the same gesture undoes itself.
      optionId === poll.myOptionId ? unvotePoll(poll.id) : votePoll(poll.id, optionId),
    onSuccess: (updated) => setPoll(updated),
    onError: (e) => toast.error((e as Error).message),
  });

  const revealed = poll.options.some((o) => o.count !== null);
  const total = poll.options.reduce((sum, o) => sum + (o.count ?? 0), 0);
  const locked = poll.closed || !user;

  return (
    <div className="mt-3 space-y-1.5">
      {poll.options.map((option) => {
        const mine = poll.myOptionId === option.id;
        const share = revealed && total > 0 ? Math.round(((option.count ?? 0) / total) * 100) : 0;

        return (
          <button
            key={option.id}
            type="button"
            disabled={locked || cast.isPending}
            onClick={() => cast.mutate(option.id)}
            className={cn(
              "relative w-full overflow-hidden rounded-xl border px-3 py-2 text-left text-sm transition-colors",
              mine ? "border-primary" : "border-border",
              !locked && "hover:border-primary/60",
              locked && "cursor-default",
            )}
          >
            {/* The bar sits behind the label rather than beside it, so a long
                option is not squeezed into half the width. */}
            {revealed && (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute inset-y-0 left-0 transition-[width] duration-500",
                  mine ? "bg-primary/15" : "bg-muted",
                )}
                style={{ width: `${share}%` }}
              />
            )}
            <span className="relative flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5">
                {mine && <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />}
                {option.label}
              </span>
              {revealed && (
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {share}%
                </span>
              )}
            </span>
          </button>
        );
      })}

      <p className="pt-0.5 text-xs text-muted-foreground">
        {cast.isPending && (
          <Loader2 className="mr-1 inline h-3 w-3 animate-spin" aria-hidden="true" />
        )}
        {poll.totalVotes} {poll.totalVotes === 1 ? "vote" : "votes"}
        {poll.closed
          ? " · closed"
          : poll.closesAt
            ? ` · closes ${new Date(poll.closesAt).toLocaleDateString()}`
            : ""}
        {!user && " · sign in to vote"}
        {/* Says why the numbers are missing, rather than leaving blank bars
            that look like a loading state that never finishes. */}
        {user && !revealed && !poll.closed && " · results after you vote"}
      </p>
    </div>
  );
}

export default PollCard;
