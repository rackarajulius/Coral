import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, Heart, MessageCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { companyPath, isVideoUrl, listPosts, timeAgo, type CommunityPost } from "@/lib/api/community";
import { COMMUNITY_TAB } from "@/lib/communityTab";
import { BRAND_NAME } from "@/lib/brand";
import type { EmployerCompany } from "@/lib/api/employerCompany";

/** How many posts the careers page shows before handing over to the community. */
const SHOWN = 3;

/**
 * What the company has said in the community, on its careers page.
 *
 * The latest few, each opening in the community tab — the same tab the main
 * nav uses — so reading a post does not take over the page someone was
 * weighing a job on. Hidden when there is nothing: an empty "Posts" heading
 * reads as a company that went quiet.
 */
export function CompanyCommunityPosts({ company }: { company?: EmployerCompany }) {
  // Posts carry the Company row's id, not the page's.
  const companyId = company?.companyId ?? null;
  const posts = useQuery({
    queryKey: ["community-posts", "company-page", companyId],
    queryFn: () => listPosts({ companyId: companyId!, limit: SHOWN }),
    enabled: !!companyId,
    staleTime: 5 * 60_000,
    retry: false,
  });

  if (!companyId || !company) return null;
  if (posts.isLoading) return <Skeleton className="h-48 rounded-2xl" />;

  const list = posts.data?.data ?? [];
  if (list.length === 0) return null;
  const total = posts.data?.meta.total ?? list.length;

  return (
    <Card id="posts" className="border-border/50 rounded-2xl scroll-mt-28">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">Posts</CardTitle>
        <p className="text-sm text-muted-foreground">
          What {company.companyName} has shared in the {BRAND_NAME} community.
        </p>
      </CardHeader>

      <CardContent>
        <ul className="divide-y divide-border">
          {list.map((post) => (
            <li key={post.id}>
              <PostRow post={post} />
            </li>
          ))}
        </ul>

        <Link
          to={companyPath(company.id)}
          target={COMMUNITY_TAB}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-link hover:underline"
        >
          {total > list.length ? `See all ${total} posts in the community` : "See them in the community"}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </CardContent>
    </Card>
  );
}

function PostRow({ post }: { post: CommunityPost }) {
  const text = post.content.trim();
  const picture = post.mediaUrls.find((url) => !isVideoUrl(url));
  return (
    <Link
      to={`/community/posts/${post.id}`}
      target={COMMUNITY_TAB}
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

export default CompanyCommunityPosts;
