import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, History, Loader2, TrendingUp, UserRound, UsersRound, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  dismissSpaceSuggestion,
  getSpaceSuggestions,
  undoDismissSpaceSuggestion,
  type SpaceSuggestion,
} from "@/lib/api/community";
import { useSpaceMembership } from "./useSpaceMembership";

/**
 * Below this, the strip is not shown: one lonely card in a carousel reads as
 * a feature nobody finished, not as a suggestion.
 */
const MIN_CARDS = 2;

const REASON_ICONS = {
  activity: History,
  peers: UsersRound,
  profile: UserRound,
  popular: TrendingUp,
} as const;

/**
 * Spaces suggested from what you have done, as a strip in the feed.
 *
 * Each card says why it is there in one line ("You've saved 2 posts from
 * here"), worked out by the server from your own activity, the people you
 * share spaces with and your profile. Closing a card is remembered across
 * devices, with an undo.
 *
 * Its query sits outside the "community-spaces" family on purpose: joining
 * invalidates that family, and a strip that refetched would pull the card you
 * just joined out from under your cursor. It flips to "Joined" instead, and
 * drops out the next time the strip is fetched.
 */
export function SuggestedSpaces() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  // Keyed by account, so one person's suggestions are never shown to the next
  // person to sign in on this browser.
  const key = ["community-space-suggestions", "feed", user?.id];

  const suggestions = useQuery({
    queryKey: key,
    queryFn: () => getSpaceSuggestions(10),
    enabled: !!user,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const spaces = suggestions.data ?? [];
  const { ref: scroller, edges, page } = useCarousel<HTMLUListElement>(spaces.length);

  const put = (space: SpaceSuggestion, index: number) =>
    queryClient.setQueryData<SpaceSuggestion[]>(key, (old = []) =>
      old.some((s) => s.id === space.id) ? old : [...old.slice(0, index), space, ...old.slice(index)],
    );
  const drop = (space: SpaceSuggestion) =>
    queryClient.setQueryData<SpaceSuggestion[]>(key, (old = []) => old.filter((s) => s.id !== space.id));

  const dismiss = (space: SpaceSuggestion, index: number) => {
    drop(space);
    const saved = dismissSpaceSuggestion(space.id);
    saved.catch((e) => {
      put(space, index);
      toast.error((e as Error).message);
    });

    toast(`We won't suggest ${space.name} again.`, {
      action: {
        label: "Undo",
        onClick: () => {
          put(space, index);
          // After the dismissal lands, never before: an undo that overtook it
          // would be deleted first and then written back.
          void saved
            .then(() => undoDismissSpaceSuggestion(space.id))
            .catch((e) => {
              drop(space);
              toast.error((e as Error).message);
            });
        },
      },
    });
  };

  // Nothing while loading, failing or short: this sits between posts, and a
  // skeleton that then vanishes moves the feed under the reader.
  if (!user || spaces.length < MIN_CARDS) return null;

  return (
    <section
      aria-labelledby="suggested-spaces-heading"
      className="rounded-2xl border border-border bg-card py-4"
    >
      <div className="mb-3 flex items-center justify-between px-4">
        <h2 id="suggested-spaces-heading" className="text-sm font-semibold">
          Suggested spaces
        </h2>
        {/* "Browse", not "See all": the search page lists every space you
            have not joined, busiest first — not more of these. */}
        <Link to="/community/search" className="text-xs text-link hover:underline">
          Browse all
        </Link>
      </div>

      <div className="relative">
        <ul
          ref={scroller}
          className="flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {spaces.map((space, index) => (
            <SuggestionCard
              key={space.id}
              space={space}
              onDismiss={() => dismiss(space, index)}
            />
          ))}
        </ul>

        {/* Touch screens swipe; the arrows are for a mouse, which cannot. */}
        {edges.left && <ArrowButton side="left" onClick={() => page(-1)} />}
        {edges.right && <ArrowButton side="right" onClick={() => page(1)} />}
      </div>
    </section>
  );
}

function SuggestionCard({ space, onDismiss }: { space: SpaceSuggestion; onDismiss: () => void }) {
  const toggle = useSpaceMembership(space);
  const [joined, setJoined] = useState(space.joined);
  const ReasonIcon = REASON_ICONS[space.reason.kind];
  const href = `/community/spaces/${space.slug}`;

  return (
    <li className="relative flex w-52 shrink-0 snap-start flex-col items-center rounded-xl border border-border bg-background px-4 pb-4 pt-5 text-center">
      <button
        type="button"
        onClick={onDismiss}
        aria-label={`Don't suggest ${space.name}`}
        title="Not interested"
        className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>

      <Link to={href} tabIndex={-1} aria-hidden="true">
        <Thumb space={space} />
      </Link>

      <Link to={href} title={space.name} className="mt-3 line-clamp-1 text-sm font-semibold hover:underline">
        {space.name}
      </Link>
      <p className="text-xs text-muted-foreground">
        {plural(space.memberCount, "member")}
        <span aria-hidden="true"> · </span>
        {plural(space.postCount, "discussion")}
      </p>

      {space.description && (
        <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{space.description}</p>
      )}

      <p className="mt-2 flex items-start justify-center gap-1.5 text-xs leading-5 text-foreground/80">
        <ReasonIcon className="mt-1 h-3 w-3 shrink-0" aria-hidden="true" />
        <span className="line-clamp-2">{space.reason.text}</span>
      </p>

      <div className="mt-auto w-full pt-3">
        <button
          type="button"
          onClick={() => toggle.mutate(!joined, { onSuccess: () => setJoined(!joined) })}
          disabled={toggle.isPending}
          aria-label={joined ? `Leave ${space.name}` : `Join ${space.name}`}
          className={cn(
            "inline-flex h-8 w-full items-center justify-center rounded-full text-sm font-semibold transition-colors disabled:opacity-60",
            joined
              ? "border border-border text-muted-foreground hover:text-foreground"
              : "bg-foreground text-background hover:bg-foreground/85",
          )}
        >
          {toggle.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : joined ? (
            "Joined"
          ) : (
            "Join"
          )}
        </button>
      </div>
    </li>
  );
}

/** The banner when there is one, otherwise the first letter on a coral tint. */
function Thumb({ space }: { space: SpaceSuggestion }) {
  return space.bannerUrl ? (
    <img
      src={space.bannerUrl}
      alt=""
      loading="lazy"
      className="h-14 w-14 rounded-2xl border border-border object-cover"
    />
  ) : (
    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-lg font-semibold text-primary">
      {space.name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

function ArrowButton({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous spaces" : "More spaces"}
      className={cn(
        "absolute top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-muted sm:flex",
        side === "left" ? "left-2" : "right-2",
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

/**
 * Whether there is more to either side, and a way to page there.
 *
 * Measured rather than assumed: on a wide screen three cards may all fit, and
 * an arrow that scrolls nowhere is a broken control.
 */
function useCarousel<T extends HTMLElement>(count: number) {
  const ref = useRef<T>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () =>
      setEdges({
        left: el.scrollLeft > 1,
        right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
      });
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      observer.disconnect();
    };
    // Cards arriving or being dismissed change the scroll width.
  }, [count]);

  const page = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: reduce ? "auto" : "smooth" });
  };

  return { ref, edges, page };
}

function plural(n: number, word: string) {
  return `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;
}

export default SuggestedSpaces;
