import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, BarChart3, Heart, MessageCircle, MessagesSquare, PlayCircle,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { PostText } from '@/components/community/feed/PostText';
import { isVideoUrl, listPosts, timeAgo, type CommunityPost } from '@/lib/api/community';

/** How many of the most recent posts the profile shows before "View all". */
const SHOWN = 3;

/**
 * What this person has posted in the community.
 *
 * Their real posts, with the counts the database actually holds. What stood
 * here was three invented posts with invented engagement — "127 likes" on a
 * fraud-detection system at Flutterwave — shown on every profile regardless of
 * who was looking at it.
 *
 * Likes and comments are reported here, not operated: this is a summary of
 * activity, and the place to reply to a post is the post.
 */
const ActivityFeed = () => {
  const { user } = useAuth();

  const posts = useQuery({
    queryKey: ['community-posts', 'profile-activity'],
    queryFn: () => listPosts({ filter: 'mine' }),
    enabled: !!user,
    retry: false,
  });

  const shown = posts.data?.data.slice(0, SHOWN) ?? [];
  const total = posts.data?.meta.total ?? 0;

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-sm transition-shadow duration-300 hover:shadow-md">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">Activity</h2>
        {total > 0 && (
          <span className="text-xs text-muted-foreground">
            {total === 1 ? '1 post' : `${total.toLocaleString()} posts`}
          </span>
        )}
      </div>

      {posts.isLoading && (
        <div className="space-y-4">
          {[0, 1].map((i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
      )}

      {posts.isError && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
          <p className="text-sm text-destructive">
            Couldn't load your activity. {(posts.error as Error).message}
          </p>
        </div>
      )}

      {posts.isSuccess && shown.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <MessagesSquare className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-foreground">Nothing here yet</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
            Posts you write in the{' '}
            <Link to="/community" className="text-link hover:underline">community</Link>{' '}
            show up here — and on your profile, they are the part employers can read.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {shown.map((post) => <ActivityItem key={post.id} post={post} />)}
      </div>

      {total > shown.length && (
        <div className="mt-4 border-t border-border pt-4">
          <Link
            to="/community?view=mine"
            className="block rounded-lg px-3 py-2 text-center text-sm text-link transition-colors hover:bg-muted/60"
          >
            View all activity
          </Link>
        </div>
      )}
    </section>
  );
};

/** One post: what was written, where, when, and how it was received. */
function ActivityItem({ post }: { post: CommunityPost }) {
  const media = post.mediaUrls[0];

  return (
    <article className="rounded-lg border border-border p-4 transition-colors hover:border-foreground/20">
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span>{timeAgo(post.createdAt)}</span>
        {post.space && (
          <>
            <span aria-hidden="true">·</span>
            <Link to={`/community/spaces/${post.space.slug}`} className="text-link hover:underline">
              {post.space.name}
            </Link>
          </>
        )}
        {post.isEdited && (
          <>
            <span aria-hidden="true">·</span>
            <span>Edited</span>
          </>
        )}
      </div>

      <div className="line-clamp-4 text-foreground">
        <PostText text={post.content} />
      </div>

      {media && (
        <div className="mt-3 overflow-hidden rounded-lg border border-border">
          {isVideoUrl(media) ? (
            <div className="relative">
              {/* Metadata only: a profile should not pull down a video nobody
                  has asked to watch. */}
              <video src={media} preload="metadata" className="h-40 w-full bg-muted object-cover" />
              <span className="absolute inset-0 flex items-center justify-center">
                <PlayCircle className="h-8 w-8 text-white drop-shadow" aria-hidden="true" />
              </span>
            </div>
          ) : (
            <img src={media} alt="" loading="lazy" className="h-40 w-full object-cover" />
          )}
        </div>
      )}

      {post.poll && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
          Poll · {post.poll.totalVotes === 1 ? '1 vote' : `${post.poll.totalVotes} votes`}
          {post.poll.closed && ' · closed'}
        </p>
      )}

      {/* Counts, not controls — reported from the database, never rounded up. */}
      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Heart className="h-4 w-4" aria-hidden="true" />
          {post._count.likes}
          <span className="sr-only">{post._count.likes === 1 ? 'like' : 'likes'}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
          {post._count.comments}
          <span className="sr-only">{post._count.comments === 1 ? 'comment' : 'comments'}</span>
        </span>
      </div>
    </article>
  );
}

export default ActivityFeed;
