import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle, BriefcaseBusiness, CalendarDays, ExternalLink, Flag, Image as ImageIcon, Link2, MessageSquareReply,
  MessagesSquare, MoreHorizontal, Users,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { BackButton, BackHeader } from "@/components/community/shell/BackButton";
import {
  authorName,
  getCommunityPerson,
  initials,
  listPersonReplies,
  listPosts,
  personPath,
  timeAgo,
  type CommunityPerson,
  type PersonFollowStatus,
  type PostAuthor,
} from "@/lib/api/community";
import { FeedPost } from "./FeedPost";
import { IdentityLine } from "./IdentityLine";
import { PersonFollowButton } from "./PersonFollowButton";
import { PostText } from "./PostText";
import { ReportDialog } from "./ReportDialog";
import { PostListSkeleton } from "./skeletons";
import { usePersonFollow } from "./usePersonFollow";

/** The tabs of someone's page, as on X: in the address, so a tab can be shared. */
type PersonTab = "posts" | "replies" | "media" | "collaborations";
const TABS: Array<{ id: PersonTab; label: string }> = [
  { id: "posts", label: "Posts" },
  { id: "replies", label: "Replies" },
  { id: "media", label: "Media" },
  { id: "collaborations", label: "Collaborations" },
];

/**
 * Someone's page in the community: who they are, Follow, and what they have
 * posted, replied, shown and collaborated on.
 *
 * Inside the community tab, so reading about an author does not drop you out
 * of the place you were reading in. Deliberately not their career profile —
 * that is for recruiters, gated on their own discoverability setting, and
 * linked from here only when it is public.
 */
export function PersonView({ personId }: { personId: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const tab = (TABS.some((t) => t.id === params.get("tab")) ? params.get("tab") : "posts") as PersonTab;
  const chooseTab = (next: PersonTab) => {
    const search = new URLSearchParams(params);
    if (next === "posts") search.delete("tab");
    else search.set("tab", next);
    setParams(search, { replace: true });
  };

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

  // Whether the header has scrolled away, for the name bar that takes its place.
  const headerRef = useRef<HTMLElement>(null);
  const [headerGone, setHeaderGone] = useState(false);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    // 56px: under the community's own top bar.
    const observer = new IntersectionObserver(([entry]) => setHeaderGone(!entry.isIntersecting), { rootMargin: "-56px 0px 0px 0px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [person.data]);

  const name = person.data ? authorName(person.data as unknown as PostAuthor) : null;
  useDocumentTitle(name ? `${name} · Community` : null);

  if (person.isLoading) {
    return (
      <>
        <BackHeader />
        <PersonSkeleton />
      </>
    );
  }

  if (person.isError || !person.data) {
    return (
      <>
        <BackHeader />
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
      </>
    );
  }

  const shownName = name ?? "Member";
  return (
    <>
      {/* "← Buni Stephen · 12 posts", as the top of an X profile. */}
      <BackHeader
        title={shownName}
        subtitle={`${person.data.postCount.toLocaleString()} ${person.data.postCount === 1 ? "post" : "posts"}`}
      />
      <NameBar person={person.data} name={shownName} shown={headerGone} />
      <PersonHeader sectionRef={headerRef} person={person.data} name={shownName} />

      <div role="tablist" aria-label={`${shownName}'s activity`} className="mb-4 flex gap-1 overflow-x-auto border-b border-border no-scrollbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => chooseTab(t.id)}
            className={cn(
              "relative shrink-0 px-4 py-2.5 text-sm font-medium transition-colors",
              tab === t.id ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {tab === t.id && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-primary" aria-hidden="true" />}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === "replies" ? (
          <PersonReplies personId={personId} name={shownName} />
        ) : (
          <PersonPosts key={tab} personId={personId} name={shownName} view={tab === "posts" ? undefined : tab} />
        )}
      </div>
    </>
  );
}

/**
 * The name and Follow, kept at the top once the header has scrolled away —
 * as on X — so following someone never needs a scroll back up.
 */
function NameBar({ person, name, shown }: { person: CommunityPerson; name: string; shown: boolean }) {
  const { user } = useAuth();
  const isMe = user?.id === person.id;
  const profileUrl = person.identity?.profileUrl ?? null;
  const isProvider = !!profileUrl?.startsWith("/providers/");
  // Their line under the name, as LinkedIn's bar keeps it; the post count when they have none.
  const subline = person.identity?.label?.trim()
    || `${person.postCount.toLocaleString()} ${person.postCount === 1 ? "post" : "posts"}`;
  return (
    <div className="sticky top-14 z-30 h-0">
      <div
        aria-hidden={!shown}
        className={cn(
          "flex items-center gap-3 rounded-b-2xl border border-t-0 border-border bg-card/95 px-4 py-2 shadow-sm backdrop-blur transition-all duration-200",
          shown ? "opacity-100" : "pointer-events-none -translate-y-2 opacity-0",
        )}
      >
        {/* The way back stays in reach once the page's own arrow has scrolled away. */}
        <BackButton className="-ml-1 h-8 w-8" />
        <Avatar className="h-8 w-8">
          <AvatarImage src={person.avatarUrl ?? ""} alt="" />
          <AvatarFallback className="bg-primary/10 text-xs text-primary">{initials(name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{subline}</p>
        </div>
        {/* What they offer, or who they are professionally, one click away —
            beside Follow, as on LinkedIn. Hidden on a phone, where the bar is tight. */}
        {profileUrl && shown && (
          <Button asChild variant="outline" size="sm" className="hidden h-8 gap-1.5 rounded-full sm:inline-flex">
            <Link to={profileUrl} state={{ from: "community", personId: person.id }}>
              {isProvider ? (isMe ? "Your services" : "Services") : "Professional profile"}
              {isProvider
                ? <BriefcaseBusiness className="h-3.5 w-3.5" aria-hidden="true" />
                : <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />}
            </Link>
          </Button>
        )}
        {!isMe && shown && <PersonFollowButton personId={person.id} className="h-8 px-4" />}
      </div>
    </div>
  );
}

function PersonHeader({ sectionRef, person, name }: { sectionRef: React.Ref<HTMLElement>; person: CommunityPerson; name: string }) {
  const { user } = useAuth();
  const { requireAuth } = useAuthModal();
  const follow = usePersonFollow(person.id);
  const isMe = user?.id === person.id;
  const followers = follow.followerCount ?? person.followerCount;
  const profileUrl = person.identity?.profileUrl ?? null;
  // A public provider profile takes the place of the career profile here.
  const isProvider = !!profileUrl?.startsWith("/providers/");
  const [reporting, setReporting] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${personPath(person.id)}`);
      toast.success("Link to their page copied");
    } catch {
      toast.error("Couldn't copy the link");
    }
  };

  return (
    <section ref={sectionRef} className="mb-4 overflow-hidden rounded-2xl border border-border bg-card">
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
            {person.joinedAt && (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                On Coral since {new Date(person.joinedAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
              </p>
            )}
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
            {person.followedBy && person.followedBy.total > 0 && <FollowedBy followedBy={person.followedBy} />}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {profileUrl && (
              // Their career profile is a page of the main site; their provider
              // profile is here in the community. Either says where you came
              // from so it can offer the way back.
              <Button asChild variant="outline" size="sm" className="gap-1.5 rounded-full">
                <Link to={profileUrl} state={{ from: "community", personId: person.id }}>
                  {isProvider
                    ? (isMe ? "Your services and work" : "Services and work")
                    : (isMe ? "Your professional profile" : "Professional profile")}
                  {isProvider
                    ? <BriefcaseBusiness className="h-3.5 w-3.5" aria-hidden="true" />
                    : <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />}
                </Link>
              </Button>
            )}
            {isMe ? (
              <span className="rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground">
                This is how the community sees you
              </span>
            ) : (
              <PersonFollowButton personId={person.id} />
            )}
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9 rounded-full" aria-label="More about this person">
                  <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="gap-2" onSelect={() => void copyLink()}>
                  <Link2 className="h-4 w-4" aria-hidden="true" /> Copy link to profile
                </DropdownMenuItem>
                {!isMe && (
                  <DropdownMenuItem className="gap-2" onSelect={() => requireAuth(() => setReporting(true))}>
                    <Flag className="h-4 w-4" aria-hidden="true" /> Report {name}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
      <ReportDialog open={reporting} onClose={() => setReporting(false)} target={{ kind: "person", id: person.id }} />
    </section>
  );
}

/**
 * "Followed by Ada, Ben and 3 others you follow", as on X: people you
 * already follow, so it only ever tells you about people you chose.
 */
function FollowedBy({ followedBy }: { followedBy: NonNullable<CommunityPerson["followedBy"]> }) {
  const { people, total } = followedBy;
  // Three names when that's everyone; otherwise two, and how many more.
  const named = people.slice(0, total > 3 ? 2 : 3);
  const others = total - named.length;
  return (
    <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
      <span className="flex -space-x-2" aria-hidden="true">
        {people.slice(0, 3).map((p) => (
          <Avatar key={p.id} className="h-6 w-6 ring-2 ring-card">
            <AvatarImage src={p.avatarUrl ?? ""} alt="" />
            <AvatarFallback className="bg-primary/10 text-[9px] text-primary">{initials(p.name)}</AvatarFallback>
          </Avatar>
        ))}
      </span>
      <span>
        Followed by{" "}
        {named.map((p, i) => (
          <span key={p.id}>
            {i > 0 && (i === named.length - 1 && others === 0 ? " and " : ", ")}
            <Link to={personPath(p.id)} className="font-medium text-foreground hover:underline">{p.name}</Link>
          </span>
        ))}
        {others > 0 && ` and ${others} ${others === 1 ? "other" : "others"} you follow`}
      </span>
    </p>
  );
}

/** What each tab says when there is nothing in it. */
const EMPTY: Record<"posts" | "media" | "collaborations", (name: string) => { title: string; body: string }> = {
  posts: (name) => ({ title: "No posts yet", body: `${name} has joined in on other people's posts, but hasn't posted anything of their own.` }),
  media: (name) => ({ title: "No pictures, video or documents yet", body: `Posts where ${name} shares pictures, a video or a document show here.` }),
  collaborations: (name) => ({ title: "No collaborations yet", body: `Posts ${name} was invited onto and accepted show here.` }),
};

/** What they have posted (or, by tab, shown or collaborated on), newest first, loading on as you scroll. */
function PersonPosts({ personId, name, view }: { personId: string; name: string; view?: "media" | "collaborations" }) {
  const posts = useInfiniteQuery({
    // The Posts tab keeps the key a new post is put into at once (feedCache);
    // the other tabs have their own, so it isn't put where it doesn't belong.
    queryKey: view ? ["community-posts", "person-view", personId, view] : ["community-posts", "person", personId],
    queryFn: ({ pageParam }) => listPosts({ page: pageParam, authorId: personId, view }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
    retry: false,
  });

  const seen = new Set<string>();
  const list = (posts.data?.pages.flatMap((p) => p.data) ?? []).filter((post) =>
    seen.has(post.id) ? false : (seen.add(post.id), true),
  );
  const sentinelRef = useLoadMore(posts);
  const empty = EMPTY[view ?? "posts"](name);

  return (
    <section aria-label={view ?? "posts"}>
      {posts.isLoading && <PostListSkeleton count={2} />}

      {posts.isError && (
        <p className="py-4 text-sm text-destructive">
          Couldn't load these.{" "}
          <button type="button" onClick={() => void posts.refetch()} className="underline">
            Try again
          </button>
        </p>
      )}

      {posts.isSuccess && list.length === 0 && (
        <EmptyTab icon={view === "media" ? ImageIcon : view === "collaborations" ? Users : MessagesSquare} {...empty} />
      )}

      <div className="space-y-2">
        {list.map((post) => (
          <FeedPost key={post.id} post={post} />
        ))}
      </div>

      <div ref={sentinelRef} aria-hidden="true" />
      <MoreStatus query={posts} label="posts" />
    </section>
  );
}

/** Their replies, each with the post it was on — the Replies tab. */
function PersonReplies({ personId, name }: { personId: string; name: string }) {
  const replies = useInfiniteQuery({
    queryKey: ["community-person-replies", personId],
    queryFn: ({ pageParam }) => listPersonReplies(personId, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
    retry: false,
  });
  const list = replies.data?.pages.flatMap((p) => p.data) ?? [];
  const sentinelRef = useLoadMore(replies);

  return (
    <section aria-label="replies">
      {replies.isLoading && <PostListSkeleton count={2} />}
      {replies.isError && (
        <p className="py-4 text-sm text-destructive">
          Couldn't load their replies.{" "}
          <button type="button" onClick={() => void replies.refetch()} className="underline">
            Try again
          </button>
        </p>
      )}
      {replies.isSuccess && list.length === 0 && (
        <EmptyTab icon={MessageSquareReply} title="No replies yet" body={`When ${name} replies to a post, it shows here.`} />
      )}

      <ul className="space-y-2">
        {list.map((reply) => (
          <li key={reply.id} className="rounded-2xl border border-border bg-card px-5 py-4">
            <p className="text-xs text-muted-foreground">
              {reply.isReplyToComment ? "Replied in a conversation on " : "Replied to "}
              <span className="font-medium text-foreground">{reply.post.by}</span>'s post · {timeAgo(reply.createdAt)}
            </p>
            <PostText text={reply.content} className="mt-2 text-sm" />
            {/* The post it was on, as a way to the whole conversation. */}
            <Link
              to={`/community/posts/${reply.post.id}`}
              className="mt-3 block rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted"
            >
              <span className="line-clamp-2">{reply.post.excerpt || "Open the post"}</span>
            </Link>
          </li>
        ))}
      </ul>

      <div ref={sentinelRef} aria-hidden="true" />
      <MoreStatus query={replies} label="replies" />
    </section>
  );
}

/** Loads the next page as the bottom of a tab comes near. */
function useLoadMore(query: { hasNextPage: boolean; isFetchingNextPage: boolean; isFetchNextPageError: boolean; fetchNextPage: () => unknown }) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = query;
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
  return sentinelRef;
}

function MoreStatus({ query, label }: { query: { isFetchingNextPage: boolean; isFetchNextPageError: boolean; fetchNextPage: () => unknown }; label: string }) {
  return (
    <>
      {query.isFetchingNextPage && (
        <div className="mt-2">
          <PostListSkeleton count={1} label={`Loading more ${label}`} />
        </div>
      )}
      {query.isFetchNextPageError && (
        <div className="flex flex-col items-center gap-2 py-6 text-sm text-muted-foreground">
          <p>Couldn't load more {label}.</p>
          <Button variant="outline" size="sm" onClick={() => void query.fetchNextPage()}>
            Try again
          </Button>
        </div>
      )}
    </>
  );
}

function EmptyTab({ icon: Icon, title, body }: { icon: React.ElementType; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-10 text-center">
      <Icon className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
      <p className="mt-3 text-sm font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>
    </div>
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
