import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getPost } from "@/lib/api/community";
import { FeedPost } from "./FeedPost";

/**
 * One post on its own, with its thread open.
 *
 * This exists because a notification needs somewhere to land. "Ada replied to
 * your comment" pointing at the top of the feed is barely a notification at
 * all — the post it concerns could be two hundred items down, and the reply
 * itself is behind a click after that.
 *
 * Also makes a post shareable, which the feed alone never was.
 */
export function PostPermalink({ postId }: { postId: string }) {
  const post = useQuery({
    queryKey: ["community-post", postId],
    queryFn: () => getPost(postId),
    retry: false,
  });

  return (
    <div>
      <Link
        to="/community"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to the community
      </Link>

      {post.isLoading && <Skeleton className="h-60 rounded-2xl" />}

      {post.isError && (
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
          <div>
            {/* Deleted and removed posts both end up here. Saying which would
                tell a stranger that a moderator acted, which is the author's
                business and the moderator's, not a passer-by's. */}
            <p className="text-sm font-medium text-destructive">This post isn't available</p>
            <p className="mt-1 text-sm text-destructive/90">
              It may have been deleted since you were linked to it.
            </p>
          </div>
        </div>
      )}

      {post.data && <FeedPost post={post.data} defaultShowComments />}
    </div>
  );
}
