import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useMatch, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  AlertTriangle, Bookmark, BriefcaseBusiness, Heart, Layers, MessagesSquare, PenSquare, Search,
  Sparkles, User as UserIcon, UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { PostComposer } from "./PostComposer";
import { FeedPost } from "./FeedPost";
import { SpaceView } from "./SpaceView";
import { CommunitySearch } from "./CommunitySearch";
import { PostPermalink } from "./PostPermalink";
import { PersonView } from "./PersonView";
import { CompanyView } from "./CompanyView";
import { SuggestedSpaces } from "./SuggestedSpaces";
import { PostListSkeleton } from "./skeletons";
import { TidesView } from "@/components/community/tides/TidesView";
import { CommunityRightRail } from "@/components/community/shell/CommunityRightRail";
import {
  VIEW_COPY, isPersonalView, isSectionView, parseView, type FeedViewId,
} from "@/components/community/shell/feedViews";
import { listPosts } from "@/lib/api/community";

/**
 * The community feed.
 *
 * Newest-first, which is what the server does today. There is no scoring yet
 * and none is faked here — a "trending" label the backend cannot support would
 * be the same fiction as the invented posts this replaces.
 *
 * What stood here rendered a hard-coded cast of people who do not exist, kept
 * new posts in component state, and logged likes to the console.
 */

/**
 * Suggested spaces sit after this many posts — far enough in that the feed
 * comes first, near enough that most people scroll past them.
 */
const SUGGESTIONS_AFTER = 3;

/** The middle column's reading width, centred in whatever space is left. */
const READING_WIDTH = "mx-auto w-full max-w-3xl";

/** What an empty slice says, and where it points. Each is empty for a different reason. */
const EMPTY_STATES: Record<FeedViewId | "all", { icon: React.ElementType; title: string; body: string }> = {
  all: {
    icon: MessagesSquare,
    title: "Nothing here yet",
    body: "This is a new community. The first posts set the tone — a question you have wanted answered is a good place to start.",
  },
  discussion: {
    icon: MessagesSquare,
    title: "No discussions yet",
    body: "Ask a question or start a conversation, and it lands here.",
  },
  showcase: {
    icon: Sparkles,
    title: "Nothing showcased yet",
    body: "Post something you made and choose Showcase as what it is for.",
  },
  opportunity: {
    icon: BriefcaseBusiness,
    title: "No opportunities yet",
    body: "Open projects, live jobs and services on offer collect here.",
  },
  following: {
    icon: UserCheck,
    title: "Nothing from the people you follow",
    body: "Follow people and companies from their posts, and what they share collects here.",
  },
  "my-spaces": {
    icon: Layers,
    title: "Quiet in your spaces",
    body: "Nobody has posted in the spaces you joined yet. Join a few more, or start the conversation yourself.",
  },
  saved: {
    icon: Bookmark,
    title: "Nothing saved yet",
    body: "Tap the bookmark on any post to keep it here for later.",
  },
  liked: {
    icon: Heart,
    title: "No liked posts yet",
    body: "Posts you like will collect here.",
  },
  mine: {
    icon: UserIcon,
    title: "You haven't posted yet",
    body: "Share what you are working on, ask a question, or start a poll.",
  },
};

/**
 * Where the reader was in each feed slice, so leaving for a post, a space or
 * another page and coming back picks up at the same place.
 *
 * Held as the post at the top of the screen and how far into it they were,
 * not as a pixel offset: images loading or new posts arriving above change
 * the page's height, and a raw offset would then land on the wrong post.
 * Module memory only — a reload clears it, and a reload starts at the top.
 */
const feedPositions = new Map<string, { postId: string | null; offset: number }>();

export function CommunityFeed() {
  /**
   * What the middle column shows comes from the URL, not from state.
   *
   * A space, a post, the tides, the search page, or the feed — and which
   * slice of the feed, from `?view=`. The nav lives in the shell, outside
   * this component, and the address is the one thing both can read.
   */
  const { slug, postId, personId, companyProfileId } = useParams<{
    slug?: string; postId?: string; personId?: string; companyProfileId?: string;
  }>();
  const searching = !!useMatch("/community/search");
  // Exact match, so /community/tides is the list while /community/tides/:id is
  // a tide's own page.
  const browsingTides = !!useMatch("/community/tides");
  const navigate = useNavigate();
  const { requireAuth } = useAuthModal();
  const [params, setParams] = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();

  // Signed out, a personal slice has nobody to belong to; the feed shows
  // everything rather than an empty "Saved" that is nobody's.
  const requested = parseView(params.get("view"));
  const view = isPersonalView(requested) && !user && !authLoading ? null : requested;
  const viewKey = view ?? "all";

  const [composeOpen, setComposeOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const showingFeed = !slug && !searching && !postId && !browsingTides && !personId && !companyProfileId;
  // Home only: the personal slices are lists of your own things.
  const showSuggestions = !!user && view === null;

  /**
   * A refresh starts at the top.
   *
   * Browsers put the reader back where they were after a reload, but the feed
   * reloads from its first page, so the old offset lands somewhere arbitrary
   * (or past the end, until more pages load). Taking restoration over while
   * the community is open, and handing it back on the way out, leaves the rest
   * of the site with the browser's normal behaviour.
   */
  useLayoutEffect(() => {
    if (!("scrollRestoration" in window.history)) return;
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);

  // The bar's "Create" arrives as ?compose=1. Opened once, then taken out of
  // the address so a reload or a back does not open it again.
  useEffect(() => {
    if (!showingFeed || params.get("compose") !== "1") return;
    setComposeOpen(true);
    const next = new URLSearchParams(params);
    next.delete("compose");
    setParams(next, { replace: true });
  }, [showingFeed, params, setParams]);

  // Nothing below this is fetched while a space or search is open; each runs
  // its own queries. Pages are fetched one after another as the reader nears
  // the end, and kept, so scrolling back up never refetches.
  const posts = useInfiniteQuery({
    queryKey: ["community-posts", "feed", view],
    queryFn: ({ pageParam }) =>
      listPosts({
        page: pageParam,
        filter: isPersonalView(view) ? view : undefined,
        section: isSectionView(view) ? view : undefined,
      }),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined,
    // A personal slice waits for the session, or it would ask as nobody.
    enabled: showingFeed && !(isPersonalView(view) && authLoading),
    retry: false,
    // Kept for a while after the feed is left, so the pages the reader had
    // scrolled through are still there to return to, and not refetched under
    // them the moment they come back.
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });

  // Newest-first with page offsets: a post published while you scroll pushes
  // the last one of a page onto the next, so the same post can arrive twice.
  const seen = new Set<string>();
  const feedPosts = (posts.data?.pages.flatMap((p) => p.data) ?? []).filter((post) =>
    seen.has(post.id) ? false : (seen.add(post.id), true),
  );

  /**
   * Put the reader back where they were in this slice, or at the top of one
   * they have not read yet.
   *
   * A passive effect plus a frame, deliberately: the app scrolls to the top on
   * every route change, and this has to land after that, once the posts are
   * on the page to measure against.
   */
  const restoredFor = useRef<string | null>(null);
  useEffect(() => {
    if (!showingFeed) {
      restoredFor.current = null;
      return;
    }
    if (restoredFor.current === viewKey) return;

    const saved = feedPositions.get(viewKey);
    if (!saved) {
      window.scrollTo(0, 0);
      restoredFor.current = viewKey;
      return;
    }
    if (!posts.isSuccess) return;

    const frame = requestAnimationFrame(() => {
      const anchor = saved.postId
        ? document.querySelector<HTMLElement>(`[data-feed-post="${CSS.escape(saved.postId)}"]`)
        : null;
      // A post that is no longer loaded (deleted, or the cache expired) has no
      // place to return to; the top is the honest fallback.
      const top = anchor ? anchor.getBoundingClientRect().top + window.scrollY - saved.offset : 0;
      window.scrollTo(0, Math.max(0, top));
      restoredFor.current = viewKey;
    });
    return () => cancelAnimationFrame(frame);
  }, [showingFeed, viewKey, posts.isSuccess]);

  // Records the place once per frame while the reader scrolls. Not until the
  // restore above has run, or the jump to the top on arrival would overwrite
  // the very position being returned to.
  useEffect(() => {
    if (!showingFeed) return;
    let frame = 0;
    const save = () => {
      frame = 0;
      if (restoredFor.current !== viewKey) return;
      let anchor: HTMLElement | null = null;
      for (const el of document.querySelectorAll<HTMLElement>("[data-feed-post]")) {
        if (el.getBoundingClientRect().bottom > 0) {
          anchor = el;
          break;
        }
      }
      feedPositions.set(viewKey, {
        postId: anchor?.dataset.feedPost ?? null,
        offset: anchor?.getBoundingClientRect().top ?? 0,
      });
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(save);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, [showingFeed, viewKey]);

  // The sentinel sits under the last post. When it comes within reach of the
  // viewport, the next page starts loading, before the reader hits the end.
  const sentinelRef = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = posts;
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage || isFetchNextPageError) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage, showingFeed]);

  if (!showingFeed) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        {postId ? (
          <PostPermalink postId={postId} />
        ) : personId ? (
          <PersonView key={personId} personId={personId} />
        ) : companyProfileId ? (
          <CompanyView key={companyProfileId} profileId={companyProfileId} />
        ) : browsingTides ? (
          <TidesView />
        ) : slug ? (
          <SpaceView key={slug} slug={slug} />
        ) : (
          <CommunitySearch />
        )}
      </div>
    );
  }

  return (
    // At least the window's height, so the rule beside the rail runs to the
    // bottom of the screen even when there are only a few posts.
    <div className="mx-auto grid min-h-[calc(100vh-3.5rem)] w-full max-w-[1120px] gap-6 px-4 pb-6 sm:px-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      {/* The column spans the whole middle track so the search row's rule can
          run edge to edge; what is read inside it keeps a reading width. */}
      <div className="w-full min-w-0">
        {/* Search and "New post" share the top row. Searching hands off to the
            search page, which already does posts, spaces and #tags. Sticky
            under the community's 3.5rem bar, so both stay put while the feed
            scrolls beneath; -mx reaches across the page's side padding so the
            rule below runs from the nav's border to the rail. */}
        <div className="sticky top-14 z-20 -mx-4 mb-5 border-b border-border bg-background px-4 pb-5 pt-6 sm:-mx-6 sm:px-6">
          <div className={cn(READING_WIDTH, "flex items-center gap-3")}>
            <form
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                const q = searchInput.trim();
                navigate(q ? `/community/search?q=${encodeURIComponent(q)}` : "/community/search");
              }}
              className="relative min-w-0 flex-1"
            >
              <Search
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search posts, spaces and #tags..."
                aria-label="Search the community"
                maxLength={60}
                className="h-10 w-full rounded-full border border-border bg-card pl-12 pr-5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground/20"
              />
            </form>
            {/* Offered signed out too: the click asks for a sign-in and then
                opens the composer, rather than hiding the way in. */}
            <Button
              size="sm"
              className="shrink-0 gap-1.5 rounded-full bg-coral px-5 text-white hover:bg-coral/90"
              onClick={() => requireAuth(() => setComposeOpen(true))}
            >
              <PenSquare className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">New post</span>
              <span className="sr-only sm:hidden">New post</span>
            </Button>
          </div>
        </div>

        <div className={READING_WIDTH}>
          {/* Every slice but Home keeps a heading, so what you are looking at
              is always named; the main feed has none. */}
          {view !== null && (
            <header className="mb-5">
              <h1 className="font-display text-2xl font-semibold tracking-tight">
                {VIEW_COPY[viewKey].title}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {VIEW_COPY[viewKey].blurb}
              </p>
            </header>
          )}

          {/* No prompt bar here: the "New post" button above opens it. */}
          <PostComposer
            spaceId={null}
            open={composeOpen}
            onOpenChange={setComposeOpen}
            showPrompt={false}
          />

          {posts.isLoading && <PostListSkeleton />}

          {posts.isError && (
            <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div className="flex-1">
                <p className="text-sm font-medium text-destructive">Couldn't load the feed</p>
                <p className="mt-1 text-sm text-destructive/90">{(posts.error as Error).message}</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => void posts.refetch()}>
                  Try again
                </Button>
              </div>
            </div>
          )}

          {posts.isSuccess && feedPosts.length === 0 && (
            <EmptyFeed view={view} onCompose={() => requireAuth(() => setComposeOpen(true))} />
          )}

          <div className="space-y-2">
            {feedPosts.map((post, i, all) => (
              <Fragment key={post.id}>
                <div data-feed-post={post.id}>
                  <FeedPost post={post} />
                </div>
                {/* After the last post when there are fewer than three. */}
                {showSuggestions && i === Math.min(SUGGESTIONS_AFTER, all.length) - 1 && <SuggestedSpaces />}
              </Fragment>
            ))}
          </div>

          <div ref={sentinelRef} aria-hidden="true" />

          {/* The next page arrives where it will sit, shaped like what it is. */}
          {isFetchingNextPage && (
            <div className="mt-2">
              <PostListSkeleton count={1} label="Loading more posts" />
            </div>
          )}

          {/* A failed page stops the automatic loading, so it does not retry
              in a loop; the reader decides when to try again. */}
          {isFetchNextPageError && (
            <div className="flex flex-col items-center gap-2 py-6 text-sm text-muted-foreground">
              <p>Couldn't load more posts.</p>
              <Button variant="outline" size="sm" onClick={() => void fetchNextPage()}>
                Try again
              </Button>
            </div>
          )}

          {feedPosts.length > 0 && !hasNextPage && !isFetchingNextPage && (
            <p className="py-6 text-center text-xs text-muted-foreground">You're all caught up.</p>
          )}
        </div>
      </div>

      {/* Beside the feed only: a space, a post or the marketplace needs the
          width more than it needs a sidebar. Ruled off from the middle column
          by its own left border, full height; the search row's rule reaches
          across the gap to meet it. */}
      <aside className="hidden pt-6 xl:block xl:border-l xl:border-border xl:pl-6">
        <div className="sticky top-20">
          <CommunityRightRail />
        </div>
      </aside>
    </div>
  );
}

function EmptyFeed({ view, onCompose }: { view: FeedViewId | null; onCompose: () => void }) {
  const empty = EMPTY_STATES[view ?? "all"];
  const Icon = empty.icon;
  return (
    <div className="rounded-2xl border border-dashed border-border p-10 text-center">
      <Icon className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
      <p className="mt-3 text-sm font-medium">{empty.title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{empty.body}</p>
      {view === "following" ? (
        <Button asChild variant="outline" size="sm" className="mt-4 rounded-full">
          <Link to="/community">Find people on Home</Link>
        </Button>
      ) : view === "my-spaces" ? (
        <Button asChild variant="outline" size="sm" className="mt-4 rounded-full">
          <Link to="/community/search?tab=spaces">Find spaces</Link>
        </Button>
      ) : view === null || view === "mine" || isSectionView(view) ? (
        <Button size="sm" className="mt-4 gap-1.5 rounded-full" onClick={onCompose}>
          <PenSquare className="h-4 w-4" aria-hidden="true" />
          Write a post
        </Button>
      ) : null}
    </div>
  );
}

export default CommunityFeed;
