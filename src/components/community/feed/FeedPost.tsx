import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bookmark, Building2, Flag, Loader2, MessageCircle, MoreHorizontal, Repeat2, Trash2,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { ReportDialog } from "./ReportDialog";
import { PollCard } from "./PollCard";
import { PostText } from "./PostText";
import { CommentThread } from "./CommentThread";
import { IdentityLine } from "./IdentityLine";
import { TidePostCard } from "@/components/community/tides/TidePostCard";
import {
  authorName,
  bookmarkPost,
  deletePost,
  isVideoUrl,
  likePost,
  resharePost,
  timeAgo,
  unbookmarkPost,
  unlikePost,
  type CommunityPost,
  type ResharedPost,
} from "@/lib/api/community";

/**
 * One post, with its replies.
 *
 * Comments are threaded server-side (`parentId`) and were never rendered — the
 * component this replaces kept posts in local state and logged likes to the
 * console, so nothing anyone did survived a refresh.
 */
export function FeedPost({
  post,
  onHashtag,
  defaultShowComments = false,
}: {
  post: CommunityPost;
  onHashtag?: (tag: string) => void;
  /** Open on the thread. Set when a notification sent you to this post. */
  defaultShowComments?: boolean;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showComments, setShowComments] = useState(defaultShowComments);

  // Hashtags are always links: without an override they open search for
  // that tag, so one clicked in a space works the same as one in the feed.
  const openTag =
    onHashtag ?? ((tag: string) => navigate(`/community/search?q=${encodeURIComponent(`#${tag}`)}`));
  const [reporting, setReporting] = useState(false);

  // Optimistic, because a like that waits for a round trip feels broken. The
  // count moves with the flag so the two never disagree on screen.
  const [liked, setLiked] = useState(post.likedByMe);
  const [likes, setLikes] = useState(post._count.likes);
  const [bookmarked, setBookmarked] = useState(post.bookmarkedByMe);

  const toggleLike = useMutation({
    mutationFn: (next: boolean) => (next ? likePost(post.id) : unlikePost(post.id)),
    onMutate: (next) => {
      setLiked(next);
      setLikes((n) => n + (next ? 1 : -1));
    },
    onError: (e, next) => {
      // Put it back. Showing a like that did not persist is worse than none.
      setLiked(!next);
      setLikes((n) => n + (next ? -1 : 1));
      toast.error((e as Error).message);
    },
  });

  const toggleBookmark = useMutation({
    mutationFn: (next: boolean) => (next ? bookmarkPost(post.id) : unbookmarkPost(post.id)),
    onMutate: (next) => setBookmarked(next),
    onError: (e, next) => {
      setBookmarked(!next);
      toast.error((e as Error).message);
    },
  });

  const remove = useMutation({
    mutationFn: () => deletePost(post.id),
    onSuccess: () => {
      toast.success("Post deleted");
      void queryClient.invalidateQueries({ queryKey: ["community-posts"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const reshare = useMutation({
    mutationFn: () => resharePost(post.id),
    onSuccess: () => {
      toast.success("Shared with your followers");
      void queryClient.invalidateQueries({ queryKey: ["community-posts"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const mine = user?.id === post.authorId;

  return (
    <article className="rounded-2xl border border-border bg-card p-5">
      <header className="flex items-start gap-3">
        {post.company ? (
          // A company post does not wear the author's face. It is the company
          // speaking, and the avatar is the first thing that says so.
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Building2 className="h-5 w-5 text-primary" aria-hidden="true" />
          </span>
        ) : (
          <Avatar className="h-10 w-10">
            <AvatarImage src={post.author.avatarUrl ?? ""} alt="" />
            <AvatarFallback className="bg-primary/10 text-xs text-primary">
              {initials(authorName(post.author))}
            </AvatarFallback>
          </Avatar>
        )}
        <div className="min-w-0 flex-1">
          {post.company ? (
            <>
              <p className="text-sm font-medium">{post.company.name}</p>
              {/* Who actually wrote it, kept visible on purpose. Hiding it
                  would make the company page a place where nobody is
                  accountable for anything said on it. */}
              <p className="text-xs text-muted-foreground">
                Posted by {authorName(post.author)}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">{authorName(post.author)}</p>
              <IdentityLine identity={post.authorIdentity} />
            </>
          )}
          <p className="text-xs text-muted-foreground">
            {/* Which room this was said in. Absent only for posts written
                before spaces existed. */}
            {post.space && <span className="text-link">{post.space.name}</span>}
            {post.space && " · "}
            {timeAgo(post.createdAt)}
            {post.isEdited && " · edited"}
          </p>
        </div>
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Post options">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {mine ? (
                <DropdownMenuItem
                  className="gap-2 text-destructive"
                  onSelect={() => remove.mutate()}
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </DropdownMenuItem>
              ) : (
                // Reporting your own post is refused server-side — you can
                // delete it — so it is not offered here either.
                <DropdownMenuItem className="gap-2" onSelect={() => setReporting(true)}>
                  <Flag className="h-4 w-4" /> Report
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      {post.content && (
        <div className="mt-3">
          <PostText text={post.content} onHashtag={openTag} />
        </div>
      )}

      {/* Shown only when there is no media of the author's own — a card about
          someone else's page should not outrank the picture they chose. */}
      {post.linkPreview && post.mediaUrls.length === 0 && (
        <a
          href={post.linkPreview.url}
          target="_blank"
          rel="nofollow noopener noreferrer ugc"
          className="mt-3 flex overflow-hidden rounded-xl border border-border transition-colors hover:border-primary/50"
        >
          {post.linkPreview.imageUrl && (
            <img
              src={post.linkPreview.imageUrl}
              alt=""
              loading="lazy"
              className="h-24 w-24 shrink-0 object-cover"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          )}
          <div className="min-w-0 flex-1 p-3">
            {post.linkPreview.siteName && (
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {post.linkPreview.siteName}
              </p>
            )}
            {post.linkPreview.title && (
              <p className="line-clamp-1 text-sm font-medium">{post.linkPreview.title}</p>
            )}
            {post.linkPreview.description && (
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {post.linkPreview.description}
              </p>
            )}
          </div>
        </a>
      )}

      {post.tideId && <TidePostCard tideId={post.tideId} />}

      {post.resharedFrom && <ResharedCard original={post.resharedFrom} />}

      {post.mediaUrls.length > 0 && (
        <div className={cn("mt-3 grid gap-2", post.mediaUrls.length > 1 && "grid-cols-2")}>
          {post.mediaUrls.map((url) =>
            isVideoUrl(url) ? (
              <video
                key={url}
                src={url}
                controls
                playsInline
                /**
                 * No autoplay, and metadata only.
                 *
                 * A feed that starts playing at you is the thing people mute
                 * their phone to avoid, and preloading every video on a page
                 * would spend someone's data on clips they never opened.
                 */
                preload="metadata"
                className="max-h-96 w-full rounded-xl bg-black object-contain"
              />
            ) : (
              <img
                key={url}
                src={url}
                alt=""
                loading="lazy"
                className="max-h-80 w-full rounded-xl object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            ),
          )}
        </div>
      )}

      {post.poll && <PollCard poll={post.poll} />}

      {post.hashtags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {/* The stored tags, which include any the server parsed out of the
              body. Same colour and same behaviour as the inline ones. */}
          {post.hashtags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => openTag(tag)}
              className="text-xs text-link hover:underline disabled:cursor-text disabled:no-underline"
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      <footer className="mt-4 flex items-center gap-1 border-t border-border pt-3">
        <Button
          variant="ghost"
          size="sm"
          className={cn("gap-1.5 text-muted-foreground", liked && "text-coral")}
          onClick={() => toggleLike.mutate(!liked)}
          aria-pressed={liked}
        >
          <HeartIcon filled={liked} />
          {likes > 0 && <span className="text-xs tabular-nums">{likes}</span>}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground"
          onClick={() => setShowComments((v) => !v)}
        >
          <MessageCircle className="h-4 w-4" />
          {post._count.comments > 0 && (
            <span className="text-xs tabular-nums">{post._count.comments}</span>
          )}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground"
          onClick={() => reshare.mutate()}
          disabled={reshare.isPending}
          aria-label="Share this post"
        >
          {reshare.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Repeat2 className="h-4 w-4" aria-hidden="true" />
          )}
          {post._count.reshares > 0 && (
            <span className="text-xs tabular-nums">{post._count.reshares}</span>
          )}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className={cn("ml-auto text-muted-foreground", bookmarked && "text-coral")}
          onClick={() => toggleBookmark.mutate(!bookmarked)}
          aria-pressed={bookmarked}
          aria-label={bookmarked ? "Remove bookmark" : "Bookmark"}
        >
          <Bookmark className={cn("h-4 w-4", bookmarked && "fill-current")} />
        </Button>
      </footer>

      {showComments && (
        <CommentThread postId={post.id} postAuthorId={post.authorId} />
      )}

      <ReportDialog
        open={reporting}
        onClose={() => setReporting(false)}
        target={{ kind: "post", id: post.id }}
      />
    </article>
  );
}

/**
 * The post being passed on, shown inside the one passing it.
 *
 * Quiet on purpose: the resharer's words come first, and this is the thing
 * they are pointing at. A moderator-removed original says so rather than
 * rendering an empty box — the reshare is still someone's post, and deleting
 * it because of what it quoted is not ours to do.
 */
function ResharedCard({ original }: { original: ResharedPost }) {
  if (original.removedAt) {
    return (
      <div className="mt-3 rounded-xl border border-dashed border-border p-4">
        <p className="text-sm text-muted-foreground">This post is no longer available.</p>
      </div>
    );
  }

  const name = original.company ? original.company.name : authorName(original.author);

  return (
    <Link
      to={`/community/posts/${original.id}`}
      className="mt-3 block rounded-xl border border-border p-4 transition-colors hover:border-primary/50"
    >
      <div className="flex items-center gap-2">
        {original.company ? (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
            <Building2 className="h-3 w-3 text-primary" aria-hidden="true" />
          </span>
        ) : (
          <Avatar className="h-6 w-6">
            <AvatarImage src={original.author.avatarUrl ?? ""} alt="" />
            <AvatarFallback className="bg-primary/10 text-[9px] text-primary">
              {initials(authorName(original.author))}
            </AvatarFallback>
          </Avatar>
        )}
        <span className="text-xs font-medium">{name}</span>
        <span className="text-xs text-muted-foreground">{timeAgo(original.createdAt)}</span>
      </div>

      {original.content && (
        <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm text-muted-foreground">
          {original.content}
        </p>
      )}

      {original.mediaUrls.length > 0 && !isVideoUrl(original.mediaUrls[0]) && (
        <img
          src={original.mediaUrls[0]}
          alt=""
          loading="lazy"
          className="mt-2 max-h-48 w-full rounded-lg object-cover"
        />
      )}
    </Link>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.2l7.8-7.7 1-1.1a5.5 5.5 0 0 0 0-7.8z" />
    </svg>
  );
}

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export default FeedPost;
