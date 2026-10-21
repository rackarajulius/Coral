import type { FeedFilter, FeedSection } from "@/lib/api/community";

/**
 * Which slice of the feed `/community` is showing, from `?view=`.
 *
 * In the URL rather than in state: the nav lives in the shell, outside the
 * feed, and a link is the only thing both can share. It also gives every
 * slice an address someone can send.
 */
export type FeedViewId = FeedFilter | FeedSection;

const SECTIONS: FeedSection[] = ["discussion", "showcase", "opportunity"];
const PERSONAL: FeedFilter[] = ["following", "my-spaces", "saved", "liked", "mine"];

export const VIEW_COPY: Record<FeedViewId | "all", { title: string; blurb: string }> = {
  // Named as the nav names it, so the row you clicked and the heading agree.
  all: {
    title: "Home",
    blurb: "A community where companies find talent, talent finds work, and professionals connect with clients.",
  },
  discussion: { title: "Discussions", blurb: "Conversations and questions from across the community." },
  showcase: { title: "Showcase", blurb: "Work people have made and chosen to show." },
  opportunity: { title: "Opportunities", blurb: "Open projects, live jobs and services on offer." },
  following: { title: "Following", blurb: "Posts from the people and companies you follow." },
  "my-spaces": { title: "My spaces", blurb: "Posts from the spaces you have joined." },
  saved: { title: "Saved", blurb: "Posts you bookmarked." },
  liked: { title: "Liked", blurb: "Posts you liked." },
  mine: { title: "Your posts", blurb: "Everything you have posted." },
};

export function parseView(raw: string | null): FeedViewId | null {
  if (!raw) return null;
  return (SECTIONS as string[]).includes(raw) || (PERSONAL as string[]).includes(raw)
    ? (raw as FeedViewId)
    : null;
}

/** Personal slices are lists of your own things, so they need you signed in. */
export const isPersonalView = (view: FeedViewId | null): view is FeedFilter =>
  !!view && (PERSONAL as string[]).includes(view);

export const isSectionView = (view: FeedViewId | null): view is FeedSection =>
  !!view && (SECTIONS as string[]).includes(view);

export const viewHref = (view: FeedViewId | null) =>
  view ? `/community?view=${view}` : "/community";
