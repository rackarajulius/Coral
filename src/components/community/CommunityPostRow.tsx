import { Link } from "react-router-dom";
import { Heart, MessageCircle } from "lucide-react";
import { isVideoUrl, streamPosterUrl, timeAgo, type CommunityPost } from "@/lib/api/community";
import { plainText } from "@/lib/mentions";

/**
 * One post as a line in someone's "Posts" card: its words, when and where,
 * its counts and a thumbnail, linking to the post itself.
 *
 * `target` is for pages outside the community tab (a careers page), so the
 * post opens there rather than taking over the page someone was reading.
 */
export function CommunityPostRow({ post, target }: { post: CommunityPost; target?: string }) {
  const text = plainText(post.content).trim();
  // A picture, or a streamed video's still.
  const picture = post.mediaUrls.find((url) => !isVideoUrl(url))
    ?? post.mediaUrls.map((url) => streamPosterUrl(url, 320)).find(Boolean);
  return (
    <Link
      to={`/community/posts/${post.id}`}
      target={target}
      className="flex gap-4 py-3 transition-colors hover:text-foreground"
    >
      <div className="min-w-0 flex-1">
        {/* A photo, a poll or a tide can have no words of its own. */}
        <p className={text ? "line-clamp-3 text-sm text-foreground/90" : "text-sm italic text-muted-foreground"}>
          {text || "Open the post"}
        </p>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{timeAgo(post.createdAt)}</span>
          {post.space && <span>in {post.space.name}</span>}
          <span className="inline-flex items-center gap-1">
            <Heart className="h-3.5 w-3.5" aria-hidden="true" />
            {post._count.likes}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
            {post._count.comments}
          </span>
        </p>
      </div>
      {picture && (
        <img
          src={picture}
          alt=""
          loading="lazy"
          className="h-16 w-16 shrink-0 rounded-lg border border-border object-cover"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      )}
    </Link>
  );
}

export default CommunityPostRow;
