import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { AlertTriangle, BadgeCheck, Building2, ExternalLink, Loader2, MessagesSquare, Plus, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useFollowCompany } from "@/hooks/useFollowCompany";
import { getCompanyById, type EmployerCompany } from "@/lib/api/employerCompany";
import { listPosts } from "@/lib/api/community";
import { CompanyTides } from "@/components/company/CompanyTides";
import { FeedPost } from "./FeedPost";
import { PostListSkeleton } from "./skeletons";
import { companyLocation } from "./ProfileHoverCard";

/**
 * A company in the community: who they are, Follow, what they are holding,
 * and what they have published in their own name.
 *
 * Inside the community tab, so reading about a company does not drop you out
 * of the place you were reading in. Its careers page — About, reviews, jobs —
 * is one click on, and is where the company's whole story lives.
 */
export function CompanyView({ profileId }: { profileId: string }) {
  // The same key as the company hover card, so a card someone hovered on the
  // way here has already fetched this.
  const company = useQuery({
    queryKey: ["company-profile", profileId],
    queryFn: () => getCompanyById(profileId),
    staleTime: 5 * 60_000,
    retry: false,
  });

  useDocumentTitle(company.data?.companyName ? `${company.data.companyName} · Community` : null);

  if (company.isLoading) return <CompanySkeleton />;

  if (company.isError || !company.data) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-6">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium">This company isn't available</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Its page may have been made private, or it no longer exists.
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
      <CompanyHeader company={company.data} />
      {/* Its own section, which hides itself when nothing is coming up. */}
      <div className="mb-5">
        <CompanyTides company={company.data} />
      </div>
      <CompanyPosts company={company.data} />
    </>
  );
}

function CompanyHeader({ company }: { company: EmployerCompany }) {
  const { user } = useAuth();
  const { requireAuth } = useAuthModal();
  const follow = useFollowCompany({ companyId: company.id, initialFollowerCount: company.followerCount ?? 0 });
  const location = companyLocation(company);
  // The server refuses both, so neither is offered: the page's owner cannot
  // follow their own company, and a page can turn followers off.
  const canFollow = company.allowFollow && company.userId !== user?.id;

  return (
    <section className="mb-5 overflow-hidden rounded-2xl border border-border bg-card">
      <div className="h-24 bg-gradient-to-br from-primary/10 via-coral/10 to-transparent" aria-hidden="true" />
      <div className="px-5 pb-5 sm:px-6">
        <div className="-mt-10 flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-border bg-card ring-4 ring-card">
          {company.companyLogo ? (
            <img src={company.companyLogo} alt="" className="h-full w-full bg-background object-contain" />
          ) : (
            <Building2 className="h-8 w-8 text-primary" aria-hidden="true" />
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-1.5 font-display text-2xl font-semibold tracking-tight">
              {company.companyName}
              {company.verificationStatus === "verified" && (
                <BadgeCheck className="h-5 w-5 shrink-0 text-coral" aria-label="Verified company" />
              )}
            </h1>
            {(company.industry || location) && (
              <p className="text-sm text-muted-foreground">
                {[company.industry, location].filter(Boolean).join(" · ")}
              </p>
            )}
            <p className="mt-2 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{follow.followerCount.toLocaleString()}</span>{" "}
              {follow.followerCount === 1 ? "follower" : "followers"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* The careers page is the main site's; it says where you came
                from so it can offer the way back. */}
            <Button asChild variant="outline" size="sm" className="gap-1.5 rounded-full">
              <Link to={`/company-profile/${company.id}`} state={{ from: "community", companyProfileId: company.id }}>
                Company page
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </Button>
            {canFollow && (
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

/** What the company published in its own name, newest first, loading on as you scroll. */
function CompanyPosts({ company }: { company: EmployerCompany }) {
  // Posts carry the Company row's id; a page that predates company accounts
  // has none, and so has nothing it could have published.
  const companyId = company.companyId;
  const posts = useInfiniteQuery({
    queryKey: ["community-posts", "company", companyId],
    queryFn: ({ pageParam }) => listPosts({ page: pageParam, companyId: companyId! }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
    enabled: !!companyId,
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

  const empty = !companyId || (posts.isSuccess && list.length === 0);

  return (
    <section aria-labelledby="company-posts">
      <h2 id="company-posts" className="mb-3 text-sm font-semibold text-muted-foreground">
        Posts
      </h2>

      {posts.isLoading && !!companyId && <PostListSkeleton count={2} />}

      {posts.isError && (
        <p className="py-4 text-sm text-destructive">
          Couldn't load their posts.{" "}
          <button type="button" onClick={() => void posts.refetch()} className="underline">
            Try again
          </button>
        </p>
      )}

      {empty && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <MessagesSquare className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium">No posts yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            {company.companyName} hasn't posted in the community yet. Follow them and their posts
            arrive in your Following feed.
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

function CompanySkeleton() {
  return (
    <div role="status" aria-label="Loading company">
      <div className="mb-5 overflow-hidden rounded-2xl border border-border bg-card">
        <Skeleton className="h-24 w-full rounded-none" />
        <div className="px-5 pb-5 sm:px-6">
          <Skeleton className="-mt-10 h-20 w-20 rounded-2xl ring-4 ring-card" />
          <Skeleton className="mt-3 h-6 w-56" />
          <Skeleton className="mt-2 h-4 w-40" />
          <Skeleton className="mt-3 h-4 w-24" />
        </div>
      </div>
      <PostListSkeleton count={2} />
    </div>
  );
}

export default CompanyView;
