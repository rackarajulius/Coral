import { Loader2, Plus, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthModal } from "@/contexts/AuthModalContext";
import type { PersonFollowStatus } from "@/lib/api/community";
import { cn } from "@/lib/utils";
import { usePersonFollow } from "./usePersonFollow";

/**
 * Follow / Following for one person, at the top of a page about them: their
 * community page and their provider profile. Asks a signed-out visitor to
 * sign in first; hovering "Following" offers Unfollow.
 *
 * Shares the follow cache with every other Follow button for them, so the
 * byline on their posts moves with this one. `initial` is the status when it
 * came with what is on screen (a list of suggestions), so nothing is fetched.
 */
export function PersonFollowButton({
  personId,
  className,
  initial,
}: {
  personId: string;
  className?: string;
  initial?: PersonFollowStatus | null;
}) {
  const follow = usePersonFollow(personId, true, initial);
  return (
    <FollowToggle
      following={follow.isFollowing}
      pending={follow.isPending}
      onToggle={follow.toggle}
      className={className}
    />
  );
}

/**
 * The button itself, for anything followable — a person or a company page —
 * so both look and behave alike wherever they sit side by side.
 */
export function FollowToggle({
  following,
  pending,
  onToggle,
  className,
}: {
  following: boolean;
  pending?: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const { requireAuth } = useAuthModal();
  return (
    <Button
      size="sm"
      onClick={() => requireAuth(onToggle)}
      disabled={pending}
      aria-pressed={following}
      className={cn(
        "group gap-1.5 rounded-full px-5",
        following
          ? "border border-border bg-transparent text-foreground hover:border-destructive/40 hover:bg-transparent hover:text-destructive"
          : "bg-coral text-white hover:bg-coral/90",
        className,
      )}
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : following ? (
        <UserCheck className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Plus className="h-4 w-4" aria-hidden="true" />
      )}
      {following ? (
        <>
          <span className="group-hover:hidden">Following</span>
          <span className="hidden group-hover:inline">Unfollow</span>
        </>
      ) : (
        "Follow"
      )}
    </Button>
  );
}

export default PersonFollowButton;
