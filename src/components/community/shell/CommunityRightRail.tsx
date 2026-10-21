import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CalendarDays, Heart, MessageCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { listPosts, authorName, type CommunityPost } from "@/lib/api/community";
import { listTides, tideWhen, type Tide } from "@/lib/api/tides";

/**
 * The feed's right-hand column, from xl up.
 *
 * Two lists, both read straight from what exists: the next tides, and the
 * posts people liked most. Each hides itself when it has nothing to show — an
 * empty box headed "Upcoming" says the community is dead more loudly than no
 * box at all.
 */
export function CommunityRightRail() {
  const tides = useQuery({
    queryKey: ["tides", "rail"],
    queryFn: () => listTides({ limit: 3 }),
    staleTime: 5 * 60_000,
    retry: false,
  });

  const top = useQuery({
    queryKey: ["community-posts", "rail", "top"],
    queryFn: () => listPosts({ sort: "top", limit: 5 }),
    staleTime: 5 * 60_000,
    retry: false,
  });

  // Canceled tides stay listed on the tides page, where the reason is shown;
  // here there is no room to say why, so they are left out.
  const upcoming = (tides.data?.data ?? []).filter((t) => !t.canceledAt);
  // A post nobody has reacted to is not "most liked", however few posts there are.
  const liked = (top.data?.data ?? []).filter((p) => p._count.likes > 0);

  return (
    <div className="space-y-4">
      {(tides.isLoading || upcoming.length > 0) && (
        <RailCard title="Upcoming tides" more={{ to: "/community/tides", label: "All tides" }}>
          {tides.isLoading ? <RailSkeleton /> : upcoming.map((tide) => <TideRow key={tide.id} tide={tide} />)}
        </RailCard>
      )}

      {(top.isLoading || liked.length > 0) && (
        <RailCard title="Most liked">
          {top.isLoading ? <RailSkeleton /> : liked.map((post) => <PostRow key={post.id} post={post} />)}
        </RailCard>
      )}
    </div>
  );
}

function RailCard({
  title,
  more,
  children,
}: {
  title: string;
  more?: { to: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between px-4 pb-1 pt-3.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
        {more && (
          <Link to={more.to} className="text-xs text-link hover:underline">
            {more.label}
          </Link>
        )}
      </div>
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}

function RailSkeleton() {
  return (
    <div className="space-y-2 px-4 py-3">
      <Skeleton className="h-4 w-3/4 rounded" />
      <Skeleton className="h-4 w-1/2 rounded" />
    </div>
  );
}

function TideRow({ tide }: { tide: Tide }) {
  // Names first, as everywhere else people are named; a host with neither
  // gets no byline rather than an invented one.
  const host =
    tide.company?.name ??
    ([tide.host.firstName, tide.host.lastName].filter(Boolean).join(" ").trim() ||
      tide.host.displayName?.trim() ||
      null);
  return (
    <Link to={`/community/tides/${tide.id}`} className="block px-4 py-3 transition-colors hover:bg-muted/60">
      <p className="line-clamp-2 text-sm font-medium">{tide.title}</p>
      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {tideWhen(tide)}
      </p>
      {host && <p className="mt-0.5 truncate text-xs text-muted-foreground">Hosted by {host}</p>}
    </Link>
  );
}

function PostRow({ post }: { post: CommunityPost }) {
  const text = post.content.trim();
  const byline = post.company?.name ?? authorName(post.author);
  return (
    <Link to={`/community/posts/${post.id}`} className="block px-4 py-3 transition-colors hover:bg-muted/60">
      <p className="truncate text-xs text-muted-foreground">
        {post.space ? `${post.space.name} · ` : ""}
        {byline}
      </p>
      {/* A photo, a poll or a reshare can have no words of its own. */}
      <p className={text ? "mt-1 line-clamp-2 text-sm font-medium" : "mt-1 text-sm italic text-muted-foreground"}>
        {text || "Open the post"}
      </p>
      <p className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Heart className="h-3.5 w-3.5" aria-hidden="true" />
          {post._count.likes} {post._count.likes === 1 ? "like" : "likes"}
        </span>
        <span className="inline-flex items-center gap-1">
          <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
          {post._count.comments} {post._count.comments === 1 ? "comment" : "comments"}
        </span>
      </p>
    </Link>
  );
}

export default CommunityRightRail;
