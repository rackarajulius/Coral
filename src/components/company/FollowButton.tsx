import { Bell, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useFollowCompany } from "@/hooks/useFollowCompany";
import { useAuthModal } from "@/contexts/AuthModalContext";

interface FollowButtonProps {
  /** Real company id. Omit for the mock/preview profile — the button becomes a static no-op. */
  companyId?: string;
  initialFollowerCount?: number;
  /** Hide entirely when the company has disabled following. */
  allowFollow?: boolean;
  /** "hero" = prominent orange pill (profile header); "compact" = small outline (cards). */
  skin?: "hero" | "compact";
  className?: string;
}

const FollowButton = ({
  companyId,
  initialFollowerCount = 0,
  allowFollow = true,
  skin = "hero",
  className,
}: FollowButtonProps) => {
  const { requireAuth } = useAuthModal();
  const { isFollowing, isPending, toggle } = useFollowCompany({
    companyId,
    initialFollowerCount,
  });

  if (!allowFollow) return null;

  const handleClick = () => {
    // Preview profile (no real id): nothing to follow.
    if (!companyId) return;
    // Signed in → toggle now; signed out → open auth, then follow on success.
    requireAuth(() => toggle());
  };

  const label = isFollowing ? "Following" : "Follow";

  if (skin === "compact") {
    return (
      <Button
        size="sm"
        variant={isFollowing ? "secondary" : "outline"}
        className={cn("rounded-full h-8", className)}
        disabled={isPending}
        onClick={handleClick}
      >
        {isFollowing && <Check className="h-3.5 w-3.5 mr-1" />}
        {label}
      </Button>
    );
  }

  return (
    <Button
      className={cn(
        "rounded-full shadow-md hover:shadow-lg transition-all px-6",
        isFollowing
          ? "bg-secondary text-foreground hover:bg-secondary/80 border border-border"
          : "bg-orange-500 hover:bg-orange-600 text-white",
        className,
      )}
      disabled={isPending}
      onClick={handleClick}
    >
      {isFollowing ? <Check className="h-4 w-4 mr-2" /> : <Bell className="h-4 w-4 mr-2" />}
      {label}
    </Button>
  );
};

export default FollowButton;
