import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The back arrow beside a page's title, as X's "← Follow".
 *
 * Goes back to wherever the reader came from, so a post opened from Saved
 * returns to Saved. When the page is the first one in this tab — opened from
 * a link, a notification or the main site — there is nothing to go back to
 * inside Coral, and it goes to `fallback` (community Home) instead of leaving.
 */
export function BackButton({ fallback = "/community", className }: { fallback?: string; className?: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  // React Router gives the first entry of a tab the key "default".
  const canGoBack = location.key !== "default";

  return (
    <button
      type="button"
      onClick={() => (canGoBack ? navigate(-1) : navigate(fallback))}
      aria-label="Back"
      title="Back"
      className={cn(
        "-ml-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <ArrowLeft className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}

/**
 * The row at the top of a page of its own, as X's "← Name · 12 posts": the
 * back arrow, what the page is, and one small fact about it.
 *
 * `heading` makes the title the page's h1, for a page with no other (a post).
 * Pages that already carry their name in a big header below (a person, a
 * company, a space) keep that as the h1, and this row only names the page.
 * Before what the page is has loaded, the arrow stands alone.
 */
export function BackHeader({
  title,
  subtitle,
  heading = false,
  fallback,
}: {
  title?: string | null;
  subtitle?: string | null;
  heading?: boolean;
  fallback?: string;
}) {
  const Title = heading ? "h1" : "p";
  return (
    <div className="mb-4 flex min-h-9 items-center gap-2">
      <BackButton fallback={fallback} />
      {title && (
        <div className="min-w-0">
          <Title className="truncate font-display text-xl font-semibold leading-tight tracking-tight">{title}</Title>
          {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      )}
    </div>
  );
}

export default BackButton;
