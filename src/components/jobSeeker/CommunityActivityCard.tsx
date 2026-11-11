import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, FileText, MessageCircle, ThumbsUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { COMMUNITY_TAB } from "@/lib/communityTab";
import { plainText } from "@/lib/mentions";
import {
  authorName,
  getCommunityPerson,
  isVideoUrl,
  listPosts,
  personPath,
  streamPosterUrl,
  timeAgo,
  type CommunityPost,
} from "@/lib/api/community";

/**
 * Their community activity on their career profile, as LinkedIn's Activity
 * card: the latest few posts, and the way to everything they have posted,
 * replied and shown.
 *
 * Only for people with a community page — someone who has posted or
 * replied. Everything here is already public in the community; links open in
 * the community's own tab, as the main site's links to it do.
 */
export function CommunityActivityCard({ personId, name }: { personId: string; name: string }) {
  const person = useQuery({
    queryKey: ["community-person", personId],
    queryFn: () => getCommunityPerson(personId),
    staleTime: 60_000,
    retry: false,
  });
  const posts = useQuery({
    // Its own key, so a new post is never put into it out of turn (feedCache).
    queryKey: ["community-posts", "person-preview", personId],
    queryFn: () => listPosts({ authorId: personId, limit: 3 }),
    enabled: person.isSuccess,
    staleTime: 60_000,
    retry: false,
  });

  // No community page (never posted or replied), or it couldn't be reached:
  // nothing to show rather than an empty box.
  if (person.isError || (!person.isLoading && !person.data)) return null;

  const page = personPath(personId);
  const followers = person.data?.followerCount ?? 0;
  const list = posts.data?.data ?? [];

  return (
    <section className="bg-card rounded-xl shadow-sm border border-border p-6" aria-labelledby="community-activity">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="community-activity" className="text-lg font-semibold text-foreground">Activity</h2>
          {person.data && (
            <p className="text-sm text-muted-foreground">
              {followers.toLocaleString()} {followers === 1 ? "follower" : "followers"} in the community
            </p>
          )}
        </div>
        {/* As LinkedIn's pills, each going to that tab of their community page. */}
        <nav className="flex flex-wrap gap-1.5" aria-label="Their activity in the community">
          {[
            { label: "Posts", to: page },
            { label: "Replies", to: `${page}?tab=replies` },
            { label: "Media", to: `${page}?tab=media` },
          ].map((pill) => (
            <Link
              key={pill.label}
              to={pill.to}
              target={COMMUNITY_TAB}
              className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
            >
              {pill.label}
            </Link>
          ))}
        </nav>
      </div>

      {(person.isLoading || posts.isLoading) && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      )}

      {posts.isSuccess && list.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          {name} hasn't posted yet, but has joined in on other people's posts.{" "}
          <Link to={`${page}?tab=replies`} target={COMMUNITY_TAB} className="text-link hover:underline">
            See their replies
          </Link>
        </p>
      )}

      {list.length > 0 && (
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {list.map((post) => (
            <li key={post.id}>
              <ActivityPost post={post} personId={personId} />
            </li>
          ))}
        </ul>
      )}

      <Link
        to={page}
        target={COMMUNITY_TAB}
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-link hover:underline"
      >
        See all activity <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </section>
  );
}

/** One post as a small card: what it shows, the first lines, and how it went. */
function ActivityPost({ post, personId }: { post: CommunityPost; personId: string }) {
  const firstMedia = post.mediaUrls[0];
  const thumbnail = firstMedia ? (isVideoUrl(firstMedia) ? streamPosterUrl(firstMedia, 480) : firstMedia) : null;
  const words = plainText(post.content).replace(/\s+/g, " ").trim();
  // A post they were asked onto says whose it is.
  const theirs = post.authorId === personId && !post.company;
  const by = post.company?.name ?? authorName(post.author);

  return (
    <Link
      to={`/community/posts/${post.id}`}
      target={COMMUNITY_TAB}
      className="flex h-full flex-col overflow-hidden rounded-xl border border-border transition-colors hover:border-foreground/30"
    >
      {thumbnail ? (
        <img src={thumbnail} alt="" loading="lazy" className="aspect-video w-full bg-muted object-cover" />
      ) : post.documentTitle ? (
        <div className="flex aspect-video items-center justify-center gap-2 bg-muted/60 px-3 text-xs text-muted-foreground">
          <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="line-clamp-2">{post.documentTitle}</span>
        </div>
      ) : null}
      <div className="flex flex-1 flex-col p-3">
        <p className="text-[11px] text-muted-foreground">
          {theirs ? "Posted" : `With ${by || "a collaborator"}`} · {timeAgo(post.createdAt)}
        </p>
        {/* Wraps even a long unbroken word, rather than running off the card. */}
        <p className="mt-1 line-clamp-3 text-sm text-foreground [overflow-wrap:anywhere]">{words || post.documentTitle || "A post"}</p>
        <p className="mt-auto flex items-center gap-3 pt-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" /> {post._count.likes}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" /> {post._count.comments}
          </span>
        </p>
      </div>
    </Link>
  );
}

export default CommunityActivityCard;
