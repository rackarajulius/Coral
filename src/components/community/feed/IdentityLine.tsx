import { Link } from "react-router-dom";
import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AuthorIdentity } from "@/lib/api/community";

/**
 * Who someone is, under their name.
 *
 * The badge is the point. It appears only when the backend could prove the
 * employment from an active company membership — never from a headline someone
 * typed — so it means something wherever it shows up.
 *
 * When that company has a page, the whole line is a link to it. It used to be
 * plain text while the backend resolved and sent the company all the same: a
 * verified employer on every post, and no way to find out anything about them.
 */
export function IdentityLine({
  identity,
  compact = false,
}: {
  identity?: AuthorIdentity;
  compact?: boolean;
}) {
  if (!identity?.label) return null;

  const body = (
    <>
      {identity.verified && (
        <BadgeCheck
          className="h-3.5 w-3.5 shrink-0 text-coral"
          aria-label="Employment verified"
        />
      )}
      {identity.label}
    </>
  );

  const classes = cn(
    "inline-flex items-center gap-1 text-muted-foreground",
    compact ? "text-[11px]" : "text-xs",
  );

  if (!identity.companyProfileId) {
    return <span className={classes}>{body}</span>;
  }

  return (
    <Link
      to={`/company-profile/${identity.companyProfileId}`}
      className={cn(classes, "hover:text-foreground hover:underline")}
      // The name alone would read as "Recruiter at" pointing somewhere; saying
      // where it goes is what a screen reader needs and sighted readers get
      // from the hover.
      title={`View ${identity.companyName}`}
    >
      {body}
    </Link>
  );
}

export default IdentityLine;
