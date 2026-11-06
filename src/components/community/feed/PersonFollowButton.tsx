import { Loader2, Plus, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { cn } from "@/lib/utils";
import { usePersonFollow } from "./usePersonFollow";

/**
 * Follow / Following for one person, at the top of a page about them: their
 * community page and their provider profile. Asks a signed-out visitor to
 * sign in first; hovering "Following" offers Unfollow.
 *
 * Shares the follow cache with every other Follow button for them, so the
 * byline on their posts moves with this one.
 */
export function PersonFollowButton({ personId, className }: { personId: string; className?: string }) {
  const { requireAuth } = useAuthModal();
  const follow = usePersonFollow(personId);

  return (
    <Button
      size="sm"
      onClick={() => requireAuth(() => follow.toggle())}
      disabled={follow.isPending}
      aria-pressed={follow.isFollowing}
      className={cn(
        "group gap-1.5 rounded-full px-5",
        follow.isFollowing
          ? "border border-border bg-transparent text-foreground hover:border-destructive/40 hover:bg-transparent hover:text-destructive"
          : "bg-coral text-white hover:bg-coral/90",
        className,
      )}
    >
      {follow.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : follow.isFollowing ? (
        <UserCheck className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Plus className="h-4 w-4" aria-hidden="true" />
      )}
      {follow.isFollowing ? (
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
