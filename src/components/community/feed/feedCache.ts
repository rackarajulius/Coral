import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import type { CommunityPost, Paged } from "@/lib/api/community";

type Page = Paged<CommunityPost>;

/**
 * Whether a post you just published belongs at the top of a cached list.
 *
 * Home and "Your posts" always; "My spaces" when it went into a space (posting
 * there joins it); your own page for a post as yourself, the company's for a
 * post in its name; and the first page of the space it went into. Everything
 * else — the sections, searches, the right rail — is left to reload when it is
 * next shown, rather than guessed at.
 */
function belongsAtTop(key: readonly unknown[], post: CommunityPost): boolean {
  const [, kind, a, b] = key;
  const spaceId = post.space?.id ?? null;
  // The Company row's id, which is what a company's feed is kept under.
  const companyId = post.company?.id ?? null;
  switch (kind) {
    case "feed":
      return a === null || a === "mine" || (a === "my-spaces" && !!spaceId);
    case "person":
      return a === post.authorId && !companyId;
    case "company":
      return !!companyId && a === companyId;
    case "space":
      return !!spaceId && a === spaceId && b === 1;
    default:
      return false;
  }
}

const isInfinite = (data: unknown): data is InfiniteData<Page> =>
  !!data && Array.isArray((data as InfiniteData<Page>).pages);
const isPage = (data: unknown): data is Page => !!data && Array.isArray((data as Page).data);

function withPostOnTop(page: Page, post: CommunityPost): Page {
  return {
    ...page,
    data: [post, ...page.data.filter((p) => p.id !== post.id)],
    meta: { ...page.meta, total: page.meta.total + 1 },
  };
}

/**
 * Puts a post you just published at the top of every cached feed it belongs
 * in — the post the server sent back, shaped exactly as the feed shapes it —
 * so it appears the moment it is saved.
 *
 * Before, the whole feed was downloaded again to find it: every page already
 * scrolled through, one after another, before it showed. Everything that lists
 * posts is still marked out of date, without fetching anything now, so each
 * list catches up the next time it is shown.
 */
export function addPostToFeeds(queryClient: QueryClient, post: CommunityPost): void {
  for (const [key, data] of queryClient.getQueriesData<InfiniteData<Page> | Page>({ queryKey: ["community-posts"] })) {
    if (!belongsAtTop(key, post)) continue;
    if (isInfinite(data) && data.pages.length > 0) {
      if (data.pages.some((p) => p.data.some((x) => x.id === post.id))) continue;
      const [first, ...rest] = data.pages;
      queryClient.setQueryData<InfiniteData<Page>>(key, { ...data, pages: [withPostOnTop(first, post), ...rest] });
    } else if (isPage(data)) {
      queryClient.setQueryData<Page>(key, withPostOnTop(data, post));
    }
  }
  void queryClient.invalidateQueries({ queryKey: ["community-posts"], refetchType: "none" });
}
