import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { CTA_LABELS, type PostCtaLabel } from "@/lib/api/community";
import { ctaSite } from "./ctaLink";

/**
 * The call-to-action bar under a post, as on LinkedIn's sponsored posts: the
 * author's headline, the site it goes to — read from the link, never typed —
 * and a button from a fixed list. The whole bar is the link, and it opens in
 * a new tab, so the reader's place in the feed stays where it was.
 *
 * `preview` draws it for the composer: the same bar, going nowhere.
 */
export function PostCtaBar({
  label,
  url,
  headline,
  onPress,
  preview = false,
}: {
  label: PostCtaLabel;
  url: string;
  headline: string;
  onPress?: () => void;
  preview?: boolean;
}) {
  const site = ctaSite(url);
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className={cn("line-clamp-2 text-sm font-semibold text-foreground", !headline && "text-muted-foreground")}>
          {headline || "Your headline"}
        </span>
        {site && (
          <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
            <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
            {site}
          </span>
        )}
      </span>
      <span className="shrink-0 rounded-full border border-primary px-4 py-1.5 text-sm font-semibold text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        {CTA_LABELS[label]}
      </span>
    </>
  );
  const shape = "group mt-3 flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3";

  if (preview) return <div className={shape} aria-label="Preview of the button bar">{body}</div>;
  return (
    <a
      href={url}
      target="_blank"
      // A link someone posted: it gets no standing from us, and the page it
      // opens gets no hold on this one.
      rel="noopener noreferrer nofollow ugc"
      onClick={onPress}
      onAuxClick={(e) => e.button === 1 && onPress?.()}
      className={cn(shape, "transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}
    >
      {body}
    </a>
  );
}

export default PostCtaBar;
