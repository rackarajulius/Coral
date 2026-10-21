/**
 * Post text with links and hashtags picked out, and nothing else.
 *
 * Built by splitting the string and returning React elements — never by
 * setting innerHTML. Post content is written by strangers, so the one rule
 * that matters is that it can never become markup.
 */
export function PostText({
  text,
  onHashtag,
}: {
  text: string;
  /** Filters the feed. Without it hashtags render as colour only, not links. */
  onHashtag?: (tag: string) => void;
}) {
  return (
    <p className="whitespace-pre-wrap [overflow-wrap:anywhere] text-sm leading-relaxed">
      {tokenise(text).map((token, i) =>
        token.kind === "link" ? (
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
  | { kind: "link"; href: string; label: string }
  | { kind: "hashtag"; tag: string };

/** Trailing punctuation belongs to the sentence, not the address. */
const TRAILING = /[.,;:!?)\]]+$/;

/**
 * URLs come first in the alternation deliberately.
 *
 * A fragment like `#section` inside an address must be consumed as part of the
 * link, not turned into a hashtag that breaks the URL in half.
 *
 * `\p{L}` rather than `\w` so tags in any script survive — `#技術` is a hashtag,
 * and `\w` would drop it.
 */
const PATTERN = /https?:\/\/[^\s<>"']+|www\.[^\s<>"']+|#[\p{L}\p{N}_]{1,50}/giu;

function tokenise(text: string): Token[] {
  const tokens: Token[] = [];
  let last = 0;

  for (const match of text.matchAll(PATTERN)) {
    const start = match.index ?? 0;
    const raw = match[0].replace(TRAILING, "");
    if (start > last) tokens.push({ kind: "text", text: text.slice(last, start) });

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
