import { UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { personInitials } from "@/lib/personName";
import type { Application } from "@/data/admin/applications/applications";

/**
 * An applicant's photo, or their initials while it loads or if it fails.
 *
 * The page used to put a field that held *either* a photo URL or two letters
 * straight into the fallback text, so anyone with a photo got a clipped piece
 * of its URL in the circle instead of their face.
 */
export function ApplicantAvatar({
  applicant,
  className,
  textClassName,
}: {
  applicant: Application["applicant"];
  className?: string;
  textClassName?: string;
}) {
  const initials = personInitials({
    firstName: applicant.firstName,
    lastName: applicant.lastName,
    displayName: applicant.displayName,
    email: applicant.email,
  });

  return (
    <Avatar className={cn("h-8 w-8", className)}>
      {applicant.avatarUrl && (
        <AvatarImage
          src={applicant.avatarUrl}
          alt={applicant.name}
          className="object-cover"
          // Hotlinked Google photos are refused when a referrer is sent.
          referrerPolicy="no-referrer"
        />
      )}
      <AvatarFallback className={cn("bg-primary text-primary-foreground text-xs", textClassName)}>
        {initials || <UserRound className="h-4 w-4" aria-hidden="true" />}
      </AvatarFallback>
    </Avatar>
  );
}
