import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { companyPath, personPath } from "@/lib/api/community";
import { MENTION_SOURCE, type MentionKind } from "@/lib/mentions";

/**
 * Post text with mentions, links and hashtags picked out, and nothing else.
 *
 * Built by splitting the string and returning React elements — never by
 * setting innerHTML. Post content is written by strangers, so the one rule
 * that matters is that it can never become markup.
 */
export function PostText({
  text,
  onHashtag,
  className,
}: {
  text: string;
  /** Filters the feed. Without it hashtags render as colour only, not links. */
  onHashtag?: (tag: string) => void;
  className?: string;
}) {
  return (
    <p className={cn("whitespace-pre-wrap [overflow-wrap:anywhere] text-sm leading-relaxed", className)}>
      {tokenise(text).map((token, i) =>
        token.kind === "mention" ? (
          // The name the server checked and saved, linked to their community
          // page. Shown without the @, as a name in a sentence.
          <Link
            key={i}
            to={token.mention === "person" ? personPath(token.id) : companyPath(token.id)}
            className="font-medium text-link hover:underline"
          >
            {token.name}
          </Link>
        ) : token.kind === "link" ? (
          <a
            key={i}
            href={token.href}
            target="_blank"
            /**
             * `noopener` stops the opened page reaching back through
             * `window.opener`. `nofollow ugc` says this is user-generated and
             * should carry no ranking weight — without it, a community is a
             * link farm within a week of anyone noticing.
             */
            rel="nofollow noopener noreferrer ugc"
            className="text-link underline-offset-2 hover:underline"
          >
            {token.label}
          </a>
        ) : token.kind === "hashtag" ? (
          <button
            key={i}
            type="button"
            onClick={() => onHashtag?.(token.tag)}
            disabled={!onHashtag}
            className="text-link hover:underline disabled:cursor-text disabled:no-underline"
          >
            #{token.tag}
          </button>
        ) : (
          <span key={i}>{token.text}</span>
        ),
      )}
    </p>
  );
}

type Token =
  | { kind: "text"; text: string }
  | { kind: "mention"; mention: MentionKind; id: string; name: string }
  | { kind: "link"; href: string; label: string }
  | { kind: "hashtag"; tag: string };

/** Trailing punctuation belongs to the sentence, not the address. */
const TRAILING = /[.,;:!?)\]]+$/;

/**
 * Mentions come first, then URLs, deliberately.
 *
 * A mention's name is shown as written, so a "#" or "www." inside a company's
 * name must not be read as a hashtag or a link.
 *
 * A fragment like `#section` inside an address must be consumed as part of the
 * link, not turned into a hashtag that breaks the URL in half.
 *
 * `\p{L}` rather than `\w` so tags in any script survive — `#技術` is a hashtag,
 * and `\w` would drop it.
 */
const PATTERN = new RegExp(
  `${MENTION_SOURCE}|https?:\\/\\/[^\\s<>"']+|www\\.[^\\s<>"']+|#[\\p{L}\\p{N}_]{1,50}`,
  "giu",
);

function tokenise(text: string): Token[] {
  const tokens: Token[] = [];
  let last = 0;

  for (const match of text.matchAll(PATTERN)) {
    const start = match.index ?? 0;
    if (start > last) tokens.push({ kind: "text", text: text.slice(last, start) });

    if (match[1] !== undefined) {
      tokens.push({ kind: "mention", name: match[1], mention: match[2] as MentionKind, id: match[3] });
      last = start + match[0].length;
      continue;
    }

    const raw = match[0].replace(TRAILING, "");
    if (raw.startsWith("#")) {
      tokens.push({ kind: "hashtag", tag: raw.slice(1) });
    } else {
      // `www.` without a scheme would otherwise resolve relative to our own site.
      const href = raw.startsWith("http") ? raw : `https://${raw}`;
      tokens.push({ kind: "link", href, label: shorten(raw) });
    }
    last = start + raw.length;
  }

  if (last < text.length) tokens.push({ kind: "text", text: text.slice(last) });
  return tokens;
}

/**
 * Long URLs are truncated for display only.
 *
 * The href stays whole — showing one destination and navigating to another is
 * how phishing works, so only the middle is elided and the host stays intact.
 */
function shorten(url: string): string {
  if (url.length <= 48) return url;
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    const host = parsed.hostname.replace(/^www\./, "");
    const rest = `${parsed.pathname}${parsed.search}`;
    return rest.length > 20 ? `${host}${rest.slice(0, 18)}…` : `${host}${rest}`;
  } catch {
    return `${url.slice(0, 45)}…`;
  }
}

export default PostText;
