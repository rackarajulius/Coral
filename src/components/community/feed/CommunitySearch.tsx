import { useEffect, useRef, useState } from "react";
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, Hash, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PostListSkeleton, SpaceRowsSkeleton } from "./skeletons";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { listPosts, listSpaces, type Space } from "@/lib/api/community";
import { FeedPost } from "./FeedPost";
import { useSpaceMembership } from "./useSpaceMembership";

type Tab = "posts" | "spaces";

const SPACE_PAGE = 10;

/**
 * Search, in the middle column.
 *
 * One place to find both things the community is made of. Before anything is
 * typed it suggests spaces you have not joined — the empty box is the moment
 * someone is most open to being pointed somewhere, and a blank card wastes it.
 * Typed, it splits into Posts and Spaces.
 *
 * `#tag` searches that hashtag rather than the words, so a hashtag clicked
 * anywhere in the community lands here.
 *
 * Query and tab live in the URL: a search can be linked, and back returns to it.
 */
export function CommunitySearch() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const tab: Tab = params.get("tab") === "spaces" ? "spaces" : "posts";

  const [input, setInput] = useState(q);
  const inputRef = useRef<HTMLInputElement>(null);

  // The click that opened search should be the last one needed.
  useEffect(() => { inputRef.current?.focus(); }, []);

  const update = (next: { q?: string; tab?: Tab }) => {
    const merged = { q, tab, ...next };
    const out = new URLSearchParams();
    if (merged.q.trim()) out.set("q", merged.q.trim());
    if (merged.tab === "spaces") out.set("tab", "spaces");
    setParams(out, { replace: true });
  };

  // Searches on a short pause: the results are the answer, and they should
  // keep up with the question rather than wait for Enter.
  useEffect(() => {
    if (input.trim() === q) return;
    const t = setTimeout(() => update({ q: input }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  // A hashtag clicked elsewhere changes the URL without any typing.
  useEffect(() => {
    if (q !== input.trim()) setInput(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          update({ q: input });
        }}
        className="relative mb-4"
      >
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setInput("")}
          placeholder="Search posts, spaces or #tags"
          aria-label="Search the community"
          // The spaces search accepts 60; longer is a sentence, not a query.
          maxLength={60}
          className="h-12 w-full rounded-2xl border border-border bg-muted/50 pl-11 pr-11 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground/20 focus:bg-background"
        />
        {input && (
          <button
            type="button"
            onClick={() => { setInput(""); inputRef.current?.focus(); }}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </form>

      {q ? (
        <>
          <div className="mb-4 flex gap-6 border-b border-border px-1" role="tablist">
            {(["posts", "spaces"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => update({ tab: t })}
                className={cn(
                  "-mb-px border-b-2 pb-2.5 text-sm transition-colors",
                  tab === t
                    ? "border-foreground font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t === "posts" ? "Posts" : "Spaces"}
              </button>
            ))}
          </div>

          {tab === "posts" ? (
            <PostResults q={q} onSeeSpaces={() => update({ tab: "spaces" })} />
          ) : (
            <SpaceResults q={q} />
          )}
        </>
      ) : (
        <Suggestions />
      )}
    </>
  );
}

/* ------------------------------ suggestions ------------------------------ */

/**
 * Spaces you have not joined, busiest first.
 *
 * Joining one keeps it in the list marked "Joined" rather than removing it
 * from under the cursor — see `SpaceResultRow`.
 */
function Suggestions() {
  const { user } = useAuth();
  // Deliberately outside the "community-spaces" key: joining invalidates that
  // family, and a suggestion list that refetches would drop the space you just
  // joined out from under your cursor.
  const suggestions = useInfiniteQuery({
    queryKey: ["community-space-suggestions", !!user],
    queryFn: ({ pageParam }) => listSpaces({ scope: "suggested", page: pageParam, limit: SPACE_PAGE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
    retry: false,
  });

  const spaces = suggestions.data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <SpaceCard title={user ? "Suggested spaces" : "Spaces"}>
      {suggestions.isLoading && <SpaceRowsSkeleton />}

      {suggestions.isError && <ErrorLine message={(suggestions.error as Error).message} />}

      {suggestions.isSuccess && spaces.length === 0 && (
        <p className="px-5 pb-5 text-sm text-muted-foreground">
          {user ? "You're in every space there is. Start a new one from the sidebar." : "No spaces yet."}
        </p>
      )}

      <div>
        {spaces.map((space) => <SpaceResultRow key={space.id} space={space} />)}
      </div>

      {suggestions.hasNextPage && (
        <MoreButton
          loading={suggestions.isFetchingNextPage}
          onClick={() => void suggestions.fetchNextPage()}
        />
      )}
    </SpaceCard>
  );
}

/* --------------------------------- results -------------------------------- */

function SpaceResults({ q }: { q: string }) {
  const results = useInfiniteQuery({
    queryKey: ["community-spaces", "search", q],
    queryFn: ({ pageParam }) => listSpaces({ scope: "all", q: stripHash(q), page: pageParam, limit: SPACE_PAGE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
    placeholderData: keepPreviousData,
    retry: false,
  });

  const spaces = results.data?.pages.flatMap((p) => p.data) ?? [];
  const total = results.data?.pages[0]?.meta.total ?? 0;

  return (
    <SpaceCard
      title={results.isSuccess ? `${total.toLocaleString()} ${total === 1 ? "space" : "spaces"}` : "Spaces"}
    >
      {results.isLoading && <SpaceRowsSkeleton />}
      {results.isError && <ErrorLine message={(results.error as Error).message} />}

      {results.isSuccess && spaces.length === 0 && (
        <p className="px-5 pb-5 text-sm text-muted-foreground">
          No space matches “{q}”. Nobody has started one yet — you can, from the + beside Your spaces.
        </p>
      )}

      <div>
        {spaces.map((space) => <SpaceResultRow key={space.id} space={space} />)}
      </div>

      {results.hasNextPage && (
        <MoreButton
          loading={results.isFetchingNextPage}
          onClick={() => void results.fetchNextPage()}
        />
      )}
    </SpaceCard>
  );
}

/**
 * Posts that match, with the best few matching spaces above them.
 *
 * The spaces strip is there because someone searching "product design" is
 * often looking for the room rather than one post in it.
 */
function PostResults({ q, onSeeSpaces }: { q: string; onSeeSpaces: () => void }) {
  const [page, setPage] = useState(1);
  const isTag = q.startsWith("#");
  const term = stripHash(q);

  useEffect(() => setPage(1), [q]);

  const posts = useQuery({
    queryKey: ["community-posts", "search", q, page],
    queryFn: () =>
      listPosts({ page, ...(isTag ? { hashtag: term } : { query: term }) }),
    placeholderData: keepPreviousData,
    retry: false,
  });

  const spaces = useQuery({
    queryKey: ["community-spaces", "search-strip", term],
    queryFn: () => listSpaces({ scope: "all", q: term, limit: 3 }),
    enabled: !isTag && !!term,
    retry: false,
  });

  const meta = posts.data?.meta;

  return (
    <>
      {spaces.data && spaces.data.data.length > 0 && (
        <SpaceCard
          title="Spaces"
          action={
            spaces.data.meta.total > spaces.data.data.length ? (
              <button type="button" onClick={onSeeSpaces} className="text-xs text-link hover:underline">
                See all {spaces.data.meta.total}
              </button>
            ) : undefined
          }
          className="mb-4"
        >
          <div>
            {spaces.data.data.map((space) => <SpaceResultRow key={space.id} space={space} compact />)}
          </div>
        </SpaceCard>
      )}

      {isTag && (
        <p className="mb-3 flex items-center gap-1.5 px-1 text-sm text-muted-foreground">
          <Hash className="h-3.5 w-3.5" aria-hidden="true" />
          Posts tagged <span className="text-link">#{term}</span>
        </p>
      )}

      {posts.isLoading && <PostListSkeleton count={2} label="Searching posts" />}

      {posts.isError && (
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{(posts.error as Error).message}</p>
        </div>
      )}

      {posts.data?.data.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-sm font-medium">No posts match that</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Try fewer words, or a #tag.
          </p>
        </div>
      )}

      <div className="space-y-2">
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
  );
}

/* ---------------------------------- rows ---------------------------------- */

/**
 * One space, laid out like a profile suggestion: thumbnail, name, who runs it,
 * what it is for, how big it is, and Join on the right.
 *
 * Joined state is held locally after a click so the row stays put and flips
 * to "Joined" — the list itself is not refetched underneath you.
 */
function SpaceResultRow({ space, compact }: { space: Space; compact?: boolean }) {
  const { user } = useAuth();
  const toggle = useSpaceMembership(space);
  const [joined, setJoined] = useState(space.joined);

  useEffect(() => setJoined(space.joined), [space.joined]);

  return (
    <div className="group flex gap-3 pl-5">
      <Link to={`/community/spaces/${space.slug}`} className="shrink-0 pt-4" tabIndex={-1}>
        <SpaceThumb space={space} />
      </Link>

      <div
        className={cn(
          "min-w-0 flex-1 border-b border-border py-4 pr-5 group-last:border-b-0",
          compact && "py-3",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              to={`/community/spaces/${space.slug}`}
              className="block truncate text-sm font-semibold hover:underline"
            >
              {space.name}
            </Link>
            <p className="truncate text-sm text-muted-foreground">
              {space.company ? space.company.name : "Space"}
            </p>
          </div>

          {/* Signed out, joining is not available, so no button pretends it is. */}
          {user && (
            <button
              type="button"
              onClick={() =>
                toggle.mutate(!joined, { onSuccess: () => setJoined(!joined) })
              }
              disabled={toggle.isPending}
              className={cn(
                "inline-flex h-8 min-w-[5.5rem] shrink-0 items-center justify-center rounded-lg px-4 text-sm font-semibold transition-colors disabled:opacity-60",
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
          )}
        </div>

        {!compact && space.description && (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed">{space.description}</p>
        )}

        <p className={cn("text-sm text-muted-foreground", compact ? "mt-1" : "mt-3")}>
          {plural(space.memberCount, "member")}
          <span aria-hidden="true"> · </span>
          {plural(space.postCount, "discussion")}
        </p>
      </div>
    </div>
  );
}

/** The banner when there is one, otherwise the first letter on a coral tint. */
function SpaceThumb({ space }: { space: Space }) {
  return space.bannerUrl ? (
    <img
      src={space.bannerUrl}
      alt=""
      loading="lazy"
      className="h-10 w-10 rounded-xl border border-border object-cover"
    />
  ) : (
    <span
      aria-hidden="true"
      className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary"
    >
      {space.name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

/* --------------------------------- chrome --------------------------------- */

function SpaceCard({
  title,
  action,
  className,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("overflow-hidden rounded-2xl border border-border bg-card", className)}>
      <div className="flex items-center justify-between px-5 pb-1 pt-5">
        <h2 className="text-sm font-semibold text-muted-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function MoreButton({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="flex w-full items-center justify-center gap-2 border-t border-border py-3 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
      Show more
    </button>
  );
}

function ErrorLine({ message }: { message: string }) {
  return (
    <p className="flex items-center gap-2 px-5 pb-5 text-sm text-destructive">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      {message}
    </p>
  );
}

function stripHash(q: string) {
  return q.replace(/^#+/, "").trim();
}

function plural(n: number, word: string) {
  return `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;
}

export default CommunitySearch;
