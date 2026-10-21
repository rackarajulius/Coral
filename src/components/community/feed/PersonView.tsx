import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ExternalLink, Loader2, MessagesSquare, Plus, UserCheck } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import {
  authorName,
  getCommunityPerson,
  initials,
  listPosts,
  type CommunityPerson,
  type PersonFollowStatus,
  type PostAuthor,
} from "@/lib/api/community";
import { FeedPost } from "./FeedPost";
import { IdentityLine } from "./IdentityLine";
import { PostListSkeleton } from "./skeletons";
import { usePersonFollow } from "./usePersonFollow";

/**
 * Someone's page in the community: who they are, Follow, and what they have
 * posted as themselves.
 *
 * Inside the community tab, so reading about an author does not drop you out
 * of the place you were reading in. Deliberately not their career profile —
 * that is for recruiters, gated on their own discoverability setting, and
 * linked from here only when it is public.
 */
export function PersonView({ personId }: { personId: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const person = useQuery({
    queryKey: ["community-person", personId],
    queryFn: () => getCommunityPerson(personId),
    staleTime: 60_000,
    retry: false,
  });

  // The header already knows the follow state; handing it to the shared
  // follow cache saves a second request and a flash of "Follow".
  useEffect(() => {
    const data = person.data;
    if (!data) return;
    const key = ["person-follow", personId, user?.id ?? null];
    if (!queryClient.getQueryData(key)) {
      queryClient.setQueryData<PersonFollowStatus>(key, {
        isFollowing: data.isFollowing,
        followerCount: data.followerCount,
      });
    }
  }, [person.data, personId, user?.id, queryClient]);

  const name = person.data ? authorName(person.data as unknown as PostAuthor) : null;
  useDocumentTitle(name ? `${name} · Community` : null);

  if (person.isLoading) return <PersonSkeleton />;

  if (person.isError || !person.data) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-6">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div>
          {/* The same words whether they never posted, closed their account or
              were removed — telling those apart is nobody else's business. */}
          <p className="text-sm font-medium">This person isn't in the community</p>
          <p className="mt-1 text-sm text-muted-foreground">
            They may not have posted yet, or their account is no longer active.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-4 rounded-full">
            <Link to="/community">Back to the community</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <PersonHeader person={person.data} name={name ?? "Member"} />
      <PersonPosts personId={personId} name={name ?? "This person"} />
    </>
  );
}

function PersonHeader({ person, name }: { person: CommunityPerson; name: string }) {
  const { user } = useAuth();
  const { requireAuth } = useAuthModal();
  const follow = usePersonFollow(person.id);
  const isMe = user?.id === person.id;
  const followers = follow.followerCount ?? person.followerCount;
  const profileUrl = person.identity?.profileUrl ?? null;

  return (
    <section className="mb-5 overflow-hidden rounded-2xl border border-border bg-card">
      <div className="h-24 bg-gradient-to-br from-primary/10 via-coral/10 to-transparent" aria-hidden="true" />
      <div className="px-5 pb-5 sm:px-6">
        <Avatar className="-mt-10 h-20 w-20 ring-4 ring-card">
          <AvatarImage src={person.avatarUrl ?? ""} alt="" />
          <AvatarFallback className="bg-primary/10 text-xl text-primary">{initials(name)}</AvatarFallback>
        </Avatar>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-semibold tracking-tight">{name}</h1>
            <IdentityLine identity={person.identity} />
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>
                <span className="font-semibold text-foreground">{followers.toLocaleString()}</span>{" "}
                {followers === 1 ? "follower" : "followers"}
              </span>
              <span>
                <span className="font-semibold text-foreground">{person.followingCount.toLocaleString()}</span> following
              </span>
              <span>
                <span className="font-semibold text-foreground">{person.postCount.toLocaleString()}</span>{" "}
                {person.postCount === 1 ? "post" : "posts"}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {profileUrl && (
              // Their career profile is a page of the main site; it says where
              // you came from so it can offer the way back.
              <Button asChild variant="outline" size="sm" className="gap-1.5 rounded-full">
                <Link to={profileUrl} state={{ from: "community", personId: person.id }}>
                  {isMe ? "Your professional profile" : "Professional profile"}
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </Button>
            )}
            {isMe ? (
              <span className="rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground">
                This is how the community sees you
              </span>
            ) : (
              <Button
                size="sm"
                onClick={() => requireAuth(() => follow.toggle())}
                disabled={follow.isPending}
                aria-pressed={follow.isFollowing}
                className={cn(
                  "group gap-1.5 rounded-full px-5",
                  follow.isFollowing
                    ? "border border-border bg-transparent text-foreground hover:border-destructive/40 hover:bg-transparent hover:text-destructive"
                    : "bg-coral text-white hover:bg-coral/90",
                )}
              >
                {follow.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : follow.isFollowing ? (
                  <UserCheck className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Plus className="h-4 w-4" aria-hidden="true" />
                )}
                {follow.isFollowing ? (
                  <>
                    <span className="group-hover:hidden">Following</span>
                    <span className="hidden group-hover:inline">Unfollow</span>
                  </>
                ) : (
                  "Follow"
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/** What they have said as themselves, newest first, loading on as you scroll. */
function PersonPosts({ personId, name }: { personId: string; name: string }) {
  const posts = useInfiniteQuery({
    queryKey: ["community-posts", "person", personId],
    queryFn: ({ pageParam }) => listPosts({ page: pageParam, authorId: personId }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
    retry: false,
  });

  const seen = new Set<string>();
  const list = (posts.data?.pages.flatMap((p) => p.data) ?? []).filter((post) =>
    seen.has(post.id) ? false : (seen.add(post.id), true),
  );

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
  }, [hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage]);

  return (
    <section aria-labelledby="person-posts">
      <h2 id="person-posts" className="mb-3 text-sm font-semibold text-muted-foreground">
        Posts
      </h2>

      {posts.isLoading && <PostListSkeleton count={2} />}

      {posts.isError && (
        <p className="py-4 text-sm text-destructive">
          Couldn't load their posts.{" "}
          <button type="button" onClick={() => void posts.refetch()} className="underline">
            Try again
          </button>
        </p>
      )}

      {posts.isSuccess && list.length === 0 && (
        // They have replied somewhere, which is why the page exists, but not
        // posted anything of their own yet.
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <MessagesSquare className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium">No posts yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            {name} has joined in on other people's posts, but hasn't posted anything of their own.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {list.map((post) => (
          <FeedPost key={post.id} post={post} />
        ))}
      </div>

      <div ref={sentinelRef} aria-hidden="true" />

      {isFetchingNextPage && (
        <div className="mt-2">
          <PostListSkeleton count={1} label="Loading more posts" />
        </div>
      )}

      {isFetchNextPageError && (
        <div className="flex flex-col items-center gap-2 py-6 text-sm text-muted-foreground">
          <p>Couldn't load more posts.</p>
          <Button variant="outline" size="sm" onClick={() => void fetchNextPage()}>
            Try again
          </Button>
        </div>
      )}
    </section>
  );
}

function PersonSkeleton() {
  return (
    <div role="status" aria-label="Loading profile">
      <div className="mb-5 overflow-hidden rounded-2xl border border-border bg-card">
        <Skeleton className="h-24 w-full rounded-none" />
        <div className="px-5 pb-5 sm:px-6">
          <Skeleton className="-mt-10 h-20 w-20 rounded-full ring-4 ring-card" />
          <Skeleton className="mt-3 h-6 w-48" />
          <Skeleton className="mt-2 h-4 w-32" />
          <Skeleton className="mt-3 h-4 w-64" />
        </div>
      </div>
      <PostListSkeleton count={2} />
    </div>
  );
}

export default PersonView;
