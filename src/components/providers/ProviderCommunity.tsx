import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CommunityPostRow } from "@/components/community/CommunityPostRow";
import { PersonFollowButton } from "@/components/community/feed/PersonFollowButton";
import { usePersonFollow } from "@/components/community/feed/usePersonFollow";
import { useAuth } from "@/contexts/AuthContext";
import { listPosts, personPath } from "@/lib/api/community";
import { BRAND_NAME } from "@/lib/brand";

/** How many posts the provider profile shows before handing over to their community page. */
const SHOWN = 3;

/**
 * Their follower count, and Follow, on their provider profile.
 *
 * The same follow as everywhere in the community: their posts reach your
 * Following feed. The owner, previewing, sees the count and no button.
 */
export function ProviderFollow({ userId }: { userId: string }) {
  const { user } = useAuth();
  const { followerCount } = usePersonFollow(userId);
  const isMe = user?.id === userId;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {followerCount !== null && (
        <span className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{followerCount.toLocaleString()}</span>{" "}
          {followerCount === 1 ? "follower" : "followers"}
        </span>
      )}
      {!isMe && <PersonFollowButton personId={userId} />}
    </div>
  );
}

/**
 * What they have posted in the community as themselves, latest first, each
 * opening the post, with the way on to their community page.
 *
 * Hidden when there is nothing: an empty "Posts" heading reads as someone who
 * went quiet, and a profile is not a prompt to post.
 */
export function ProviderPosts({ userId, name }: { userId: string; name: string }) {
  const posts = useQuery({
    queryKey: ["community-posts", "provider-profile", userId],
    queryFn: () => listPosts({ authorId: userId, limit: SHOWN }),
    staleTime: 5 * 60_000,
    retry: false,
  });

  if (posts.isLoading) return <Skeleton className="h-48 rounded-2xl" />;
  const list = posts.data?.data ?? [];
  if (list.length === 0) return null;
  const total = posts.data?.meta.total ?? list.length;

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Posts</CardTitle>
        <p className="text-sm text-muted-foreground">What {name} has shared in the {BRAND_NAME} community.</p>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border">
          {list.map((post) => (
            <li key={post.id}>
              <CommunityPostRow post={post} />
            </li>
          ))}
        </ul>
        <Link
          to={personPath(userId)}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-link hover:underline"
        >
          {total > list.length ? `See all ${total} posts` : "See their community page"}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </CardContent>
    </Card>
  );
}
