import { useState } from "react";
import { useMatch, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, MessagesSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PostComposer } from "./PostComposer";
import { FeedPost } from "./FeedPost";
import { CommunitySidebar, type FeedView } from "./CommunitySidebar";
import { SpaceView } from "./SpaceView";
import { CommunitySearch } from "./CommunitySearch";
import { PostPermalink } from "./PostPermalink";
import { TidesView } from "@/components/community/tides/TidesView";
import { listPosts, type FeedFilter } from "@/lib/api/community";

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
/** Slices that can be linked to, e.g. "View all activity" on a profile. */
const LINKABLE_FILTERS: FeedFilter[] = ["my-spaces", "saved", "liked", "mine"];

const VIEW_TITLES: Record<string, string> = {
  all: "Community",
  "my-spaces": "My spaces",
  saved: "Saved",
  liked: "Liked",
  mine: "Your posts",
};

const VIEW_BLURBS: Record<string, string> = {
  all: "A community where companies find talent, talent finds work, and professionals connect with clients.",
  "my-spaces": "Posts from the spaces you have joined.",
  saved: "Posts you bookmarked.",
  liked: "Posts you liked.",
  mine: "Everything you have posted.",
};

export function CommunityFeed() {
  /**
   * What the middle column shows comes from the URL, not from state.
   *
   * A space, the search page, or the feed. That keeps each address shareable
   * and indexable while the sidebar stays put and only the middle column
   * changes.
   */
  const { slug, postId } = useParams<{ slug?: string; postId?: string }>();
  const searching = !!useMatch("/community/search");
  // Exact match, so /community/tides is the list while /community/tides/:id is
  // a tide's own page, which lives outside this shell.
  const browsingTides = !!useMatch("/community/tides");
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // ?view=mine opens straight into a slice — the profile's "View all activity"
  // link needs an address, and the sidebar alone had none.
  const [view, setView] = useState<FeedView>(() => {
    const requested = params.get("view") as FeedFilter | null;
    return {
      filter: requested && LINKABLE_FILTERS.includes(requested) ? requested : null,
      spaceId: null,
    };
  });
  const [page, setPage] = useState(1);
  const [composeOpen, setComposeOpen] = useState(false);
  const { filter, spaceId } = view;
  const showingFeed = !slug && !searching && !postId && !browsingTides;

  // Nothing below this is fetched while a space or search is open; each runs
  // its own queries.
  const posts = useQuery({
    queryKey: ["community-posts", page, spaceId, filter],
    queryFn: () =>
      listPosts({
        page,
        spaceId: spaceId ?? undefined,
        filter: filter ?? undefined,
      }),
    enabled: showingFeed,
    retry: false,
  });

  const meta = posts.data?.meta;

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[240px_1fr]">
      {/* The rail is the structure: it turns a river nobody owns into rooms
          people can be in. Below lg it sits above the feed rather than
          disappearing — it is how you change what you are reading. */}
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <CommunitySidebar
          view={view}
          activeSlug={slug ?? null}
          searching={searching}
          browsingTides={browsingTides}
          onView={(next) => {
            // Choosing a feed means leaving whatever space or search is open.
            if (!showingFeed) navigate("/community");
            setView(next);
            setPage(1);
          }}
          onCompose={() => {
            // The composer lives with the feed, so from search or a space
            // "New post" brings the feed back and opens it there.
            if (!showingFeed) navigate("/community");
            setComposeOpen(true);
          }}
        />
      </aside>

      <div className="min-w-0">
        {postId ? (
          <PostPermalink postId={postId} />
        ) : browsingTides ? (
          <TidesView />
        ) : slug ? (
          <SpaceView slug={slug} />
        ) : searching ? (
          <CommunitySearch />
        ) : (
          <>
            {/* The heading follows the sidebar rather than staying "Community",
                so what you are looking at is always named. */}
            <header className="mb-5">
              <h1 className="font-display text-2xl font-semibold tracking-tight">
                {VIEW_TITLES[filter ?? "all"]}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {VIEW_BLURBS[filter ?? "all"]}
              </p>
            </header>

            <div className="mb-5">
              <PostComposer
                spaceId={spaceId}
                open={composeOpen}
                onOpenChange={setComposeOpen}
              />
            </div>

            {posts.isLoading && (
              <div className="space-y-4">
                {[0, 1, 2].map((i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}
              </div>
            )}

            {posts.isError && (
              <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <div>
                  <p className="text-sm font-medium text-destructive">Couldn't load the feed</p>
                  <p className="mt-1 text-sm text-destructive/90">{(posts.error as Error).message}</p>
                </div>
              </div>
            )}

            {posts.data?.data.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border p-10 text-center">
                <MessagesSquare className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
                <p className="mt-3 text-sm font-medium">Nothing here yet</p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                  This is a new community. The first posts set the tone — a question you have
                  wanted answered is a good place to start.
                </p>
              </div>
            )}

            <div className="space-y-4">
              {posts.data?.data.map((post) => <FeedPost key={post.id} post={post} />)}
            </div>

            {meta && meta.totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  disabled={page <= 1 || posts.isFetching}
                >
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground">
                  Page {meta.page} of {meta.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= meta.totalPages || posts.isFetching}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default CommunityFeed;
