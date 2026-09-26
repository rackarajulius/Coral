import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  Bookmark, CalendarDays, Heart, Home, Layers, Loader2, PenSquare, Plus, Search, ShieldCheck,
  User as UserIcon,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { listReports, listSpaces, type FeedFilter, type Space } from "@/lib/api/community";
import { NewSpaceDialog } from "./NewSpaceDialog";
import { useSpaceMembership } from "./useSpaceMembership";

export interface FeedView {
  filter: FeedFilter | null;
  spaceId: string | null;
}

/** How many of your spaces the rail lists before handing over to the directory. */
const RAIL_LIMIT = 30;

/**
 * The community's own navigation.
 *
 * Every row here changes what the feed shows and is backed by a real query —
 * there is no Activity, Insights or Archive, because none of those exist and a
 * nav full of dead rows is the fastest way to make a product feel abandoned.
 *
 * The Spaces section lists the spaces *you* joined, never all of them. The
 * full list grows with the platform; yours grows with your choices, which is
 * the only version of it that keeps fitting on a screen. Everything else is
 * found through Search, which suggests spaces you have not joined.
 */
export function CommunitySidebar({
  view,
  onView,
  onCompose,
  activeSlug,
  searching,
  browsingTides,
}: {
  view: FeedView;
  /** Which space the URL has open, so the row highlights without duplicating state. */
  activeSlug?: string | null;
  /** True while search has the middle column. */
  searching?: boolean;
  /** True while the tides listing has it. */
  browsingTides?: boolean;
  onView: (next: FeedView) => void;
  onCompose: () => void;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [newSpaceOpen, setNewSpaceOpen] = useState(false);

  // Paged, with "Show more" loading the next batch in place: the rail scrolls
  // on its own, so a long list of your own spaces stays reachable here rather
  // than being sent somewhere else. Its own key — the composer's picker reads
  // the first page as a plain query, and the two cache shapes differ.
  const mine = useInfiniteQuery({
    queryKey: ["community-spaces", "mine", "rail"],
    queryFn: ({ pageParam }) => listSpaces({ scope: "mine", page: pageParam, limit: RAIL_LIMIT }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
    enabled: !!user,
    retry: false,
  });
  const mineSpaces = mine.data?.pages.flatMap((p) => p.data) ?? [];

  /**
   * The fallback for an empty rail.
   *
   * Signed out, or signed in with nothing joined yet, the section would
   * otherwise be a heading over nothing — and the first visit is exactly when
   * someone most needs to be shown where the conversation is.
   */
  const showPopular = !user || (mine.isSuccess && mineSpaces.length === 0);
  const popular = useQuery({
    queryKey: ["community-spaces", "popular"],
    queryFn: () => listSpaces({ scope: "popular", limit: 6 }),
    enabled: showPopular,
    retry: false,
  });

  const listSpacesShown = showPopular ? popular.data?.data ?? [] : mineSpaces;
  const listLoading = showPopular ? popular.isLoading : mine.isLoading;
  const mineTotal = mine.data?.pages[0]?.meta.total ?? 0;
  const hiddenCount = showPopular ? 0 : mineTotal - mineSpaces.length;

  /**
   * Moderation is shown only to people the server will actually let in.
   *
   * Asked by trying: there is no "am I a moderator" endpoint, and a 403 here
   * is a cheap, truthful answer. Failing quietly hides the row rather than
   * offering a door that does not open.
   */
  const canModerate = useQuery({
    queryKey: ["moderation-access"],
    queryFn: () => listReports("OPEN").then(() => true).catch(() => false),
    enabled: !!user,
    staleTime: 5 * 60_000,
    retry: false,
  });

  // A feed row is only active when nothing else has the middle column —
  // otherwise "For you" would stay lit while you are reading somewhere else.
  const isActive = (filter: FeedFilter | null) =>
    !activeSlug && !searching && view.filter === filter;

  const { ref: scrollRef, maskClass } = useScrollEdges<HTMLElement>();

  return (
    // Scrolls on its own at desktop widths: the rail is sticky, so anything
    // past the bottom of the viewport would otherwise be unreachable no
    // matter how far the page scrolls.
    <nav
      ref={scrollRef}
      className={cn(
        "space-y-6 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:overscroll-contain lg:pb-2",
        "[scrollbar-width:thin]",
        maskClass,
      )}
      aria-label="Community"
    >
      <div className="space-y-0.5">
        <Row
          icon={PenSquare}
          label="New post"
          onClick={onCompose}
          emphasis
        />
        <Row
          icon={Home}
          label="For you"
          active={isActive(null)}
          onClick={() => onView({ filter: null, spaceId: null })}
        />
        <Row icon={Search} label="Search" active={searching} to="/community/search" />
        {/* Backed by a real listing, like every other row here. */}
        <Row icon={CalendarDays} label="Tides" active={browsingTides} to="/community/tides" />
      </div>

      {/* Signed-out visitors can read everything and own none of it, so the
          personal rows are absent rather than present and empty. */}
      {user && (
        <div className="space-y-0.5">
          <Row
            icon={Layers}
            label="My spaces"
            active={isActive("my-spaces")}
            onClick={() => onView({ filter: "my-spaces", spaceId: null })}
          />
          <Row
            icon={Bookmark}
            label="Saved"
            active={isActive("saved")}
            onClick={() => onView({ filter: "saved", spaceId: null })}
          />
          <Row
            icon={Heart}
            label="Liked"
            active={isActive("liked")}
            onClick={() => onView({ filter: "liked", spaceId: null })}
          />
          <Row
            icon={UserIcon}
            label="Your posts"
            active={isActive("mine")}
            onClick={() => onView({ filter: "mine", spaceId: null })}
          />
          {canModerate.data && (
            <Row icon={ShieldCheck} label="Moderation" to="/community/moderation" />
          )}
        </div>
      )}

      <div>
        <div className="mb-1.5 flex items-center justify-between px-2">
          <p className="text-xs font-semibold text-muted-foreground">
            {showPopular ? "Popular spaces" : "Your spaces"}
          </p>
          {/* Only for signed-in people: creating one makes you its moderator,
              which is not something an anonymous visitor can be. */}
          {user && (
            <button
              type="button"
              onClick={() => setNewSpaceOpen(true)}
              aria-label="Start a space"
              title="Start a space"
              className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
        </div>

        {listLoading && (
          <div className="space-y-1.5 px-2">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-6 rounded" />)}
          </div>
        )}

        {/* Below lg the rail sits above the feed, so the list gets its own
            short scroll there rather than pushing the posts off the screen. */}
        <div className="max-h-56 space-y-0.5 overflow-y-auto [scrollbar-width:thin] lg:max-h-none lg:overflow-visible">
          {listSpacesShown.map((space) => (
            <SpaceRow key={space.id} space={space} active={activeSlug === space.slug} />
          ))}
        </div>

        {showPopular && popular.isSuccess && (
          <p className="mt-2 px-2.5 text-xs leading-relaxed text-muted-foreground">
            {user && "Join a space and it stays here. "}
            <Link to="/community/search" className="text-link hover:underline">
              Find more
            </Link>
          </p>
        )}

        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => void mine.fetchNextPage()}
            disabled={mine.isFetchingNextPage}
            className="mt-1 flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-link hover:underline"
          >
            {mine.isFetchingNextPage && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
            Show {Math.min(hiddenCount, RAIL_LIMIT)} more
          </button>
        )}
      </div>

      <NewSpaceDialog
        open={newSpaceOpen}
        onClose={() => setNewSpaceOpen(false)}
        // Opens straight into it — you made it because you had something to
        // say there.
        onCreated={(space) => navigate(`/community/spaces/${space.slug}`)}
      />
    </nav>
  );
}

/**
 * Which edges of a scroller have content beyond them, as a mask class.
 *
 * Measured rather than always-on: fading both edges of a list short enough not
 * to scroll dims its first and last rows, which reads as "disabled" rather
 * than "there is more". Same approach as the employer sidebar.
 */
function useScrollEdges<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [edges, setEdges] = useState({ top: false, bottom: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const overflowing = el.scrollHeight - el.clientHeight > 1;
      setEdges({
        top: overflowing && el.scrollTop > 1,
        bottom: overflowing && el.scrollTop + el.clientHeight < el.scrollHeight - 1,
      });
    };

    measure();
    el.addEventListener("scroll", measure, { passive: true });
    // Lists arriving, a space being joined, or the viewport changing all alter
    // the scroll height without a scroll event.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    Array.from(el.children).forEach((c) => observer.observe(c));

    return () => {
      el.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, []);

  const maskClass = edges.top && edges.bottom
    ? "lg:nav-mask-both"
    : edges.top
      ? "lg:nav-mask-top"
      : edges.bottom
        ? "lg:nav-mask-bottom"
        : "";

  return { ref, maskClass };
}

/* ---------------------------------- rows ---------------------------------- */

function Row({
  icon: Icon,
  label,
  active,
  emphasis,
  onClick,
  to,
}: {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  emphasis?: boolean;
  onClick?: () => void;
  to?: string;
}) {
  const className = cn(
    "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors",
    active ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
    emphasis && "font-medium text-foreground",
  );

  const body = (
    <>
      <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
      {label}
    </>
  );

  return to ? (
    <Link to={to} className={className}>{body}</Link>
  ) : (
    <button type="button" onClick={onClick} className={className}>{body}</button>
  );
}

/**
 * A space, with joining folded into the row.
 *
 * The action sits on the right and only appears on hover — a column of
 * buttons competes with the names, and the name is what you came to read.
 * Under "Your spaces" every row is joined, so a permanent "Joined" label would
 * be the same word thirty times; the row offers "Leave" on hover instead.
 */
function SpaceRow({ space, active }: { space: Space; active: boolean }) {
  const { user } = useAuth();
  const toggle = useSpaceMembership(space);

  return (
    <div
      className={cn(
        "group flex items-center gap-1 rounded-lg pr-1 transition-colors",
        active ? "bg-muted" : "hover:bg-muted/60",
      )}
    >
      {/* A link, not a filter: a space has its own address now, and that URL
          is the thing someone can send to a friend or a search engine. */}
      <Link
        to={`/community/spaces/${space.slug}`}
        title={space.name}
        className={cn(
          "min-w-0 flex-1 truncate px-2.5 py-2 text-left text-sm",
          active ? "font-medium text-foreground" : "text-muted-foreground group-hover:text-foreground",
        )}
      >
        {space.name}
      </Link>

      {user && (
        <button
          type="button"
          onClick={() => toggle.mutate(!space.joined)}
          disabled={toggle.isPending}
          className={cn(
            "shrink-0 rounded-md px-2 py-1 text-[11px] opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100",
            space.joined ? "text-muted-foreground hover:text-foreground" : "text-link",
            toggle.isPending && "opacity-100",
          )}
        >
          {toggle.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          ) : space.joined ? (
            "Leave"
          ) : (
            "Join"
          )}
        </button>
      )}
    </div>
  );
}

export default CommunitySidebar;
