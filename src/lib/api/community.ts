import supabase from "@/lib/supabase";
import { personName } from "@/lib/personName";
import { fitImage, IMAGE_SIZES } from "@/lib/imageResize";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

async function req<T>(path: string, init: RequestInit = {}, expectedSupabaseId?: string): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (expectedSupabaseId && session?.user.id !== expectedSupabaseId) {
    throw new Error("Your signed-in account changed. Reload before continuing.");
  }
  const res = await fetch(`${API_BASE_URL}/community${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message || "Request failed");
  }
  const body = await res.json() as T;
  if (expectedSupabaseId) {
    const { data: { session: current } } = await supabase.auth.getSession();
    if (current?.user.id !== expectedSupabaseId) throw new Error("Your signed-in account changed. Reload before continuing.");
  }
  return body;
}

export type SpaceKind = "TOPIC" | "COMPANY";

export interface Space {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  /** Also the list thumbnail. Null means none was set. */
  bannerUrl: string | null;
  kind: SpaceKind;
  company: { id: string; name: string } | null;
  memberCount: number;
  postCount: number;
  joined: boolean;
  /**
   * Both that the space allows it and that it has enough members for a
   * pseudonym to mean anything. Only the server knows the second, so this is
   * reported rather than derived here.
   */
  anonymityAvailable: boolean;
}

/** What a space's own page needs, beyond what the sidebar shows. */
export interface SpaceDetail extends Space {
  createdAt: string;
  /** Null when you are not a member. MODERATOR unlocks editing. */
  myRole: "MEMBER" | "MODERATOR" | null;
  moderators: { id: string; name: string; avatarUrl: string | null }[];
}

export const setSpaceBanner = (spaceId: string, bannerUrl: string | null) =>
  req<{ data: { id: string; bannerUrl: string | null } }>(`/spaces/${spaceId}/banner`, {
    method: "POST",
    body: JSON.stringify({ bannerUrl: bannerUrl ?? undefined }),
  }).then((r) => r.data);

/**
 * `mine` for the sidebar, `popular` for someone who has joined nothing,
 * `suggested` (not yet joined) for the search page, `all` for search results.
 * The sidebar never asks for `all` — that list grows with the platform, and a
 * nav that grows with the platform stops fitting on screen.
 */
export type SpaceScope = "mine" | "popular" | "suggested" | "all";

export const listSpaces = (opts: { scope?: SpaceScope; q?: string; page?: number; limit?: number } = {}) => {
  const params = new URLSearchParams();
  if (opts.scope) params.set("scope", opts.scope);
  if (opts.q?.trim()) params.set("q", opts.q.trim());
  if (opts.page) params.set("page", String(opts.page));
  if (opts.limit) params.set("limit", String(opts.limit));
  const qs = params.toString();
  return req<{
    data: Space[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }>(`/spaces${qs ? `?${qs}` : ""}`);
};

export const getSpace = (slug: string) =>
  req<{ data: SpaceDetail }>(`/spaces/${slug}`).then((r) => r.data);

export const createSpace = (input: { name: string; description?: string; bannerUrl?: string }) =>
  req<{ data: Space }>("/spaces", { method: "POST", body: JSON.stringify(input) }).then((r) => r.data);

export const joinSpace = (id: string) =>
  req<unknown>(`/spaces/${id}/join`, { method: "POST" });

export const leaveSpace = (id: string) =>
  req<unknown>(`/spaces/${id}/join`, { method: "DELETE" });

/**
 * Why a space is suggested, in words. `activity` is something you did there,
 * `peers` is people you share a space with, `profile` is your skills, role or
 * industry, and `popular` is the fill when nothing else applies.
 */
export interface SpaceSuggestion extends Space {
  reason: { kind: "activity" | "peers" | "profile" | "popular"; text: string };
}

/** Signed in only — built from what you have done. */
export const getSpaceSuggestions = (limit = 10) =>
  req<{ data: SpaceSuggestion[] }>(`/spaces/suggestions?limit=${limit}`).then((r) => r.data);

/** "Not interested": the space is not suggested to you again. */
export const dismissSpaceSuggestion = (id: string) =>
  req<unknown>(`/spaces/${id}/dismiss`, { method: "POST" });

export const undoDismissSpaceSuggestion = (id: string) =>
  req<unknown>(`/spaces/${id}/dismiss`, { method: "DELETE" });

export type PostType =
  | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "JOB" | "CAROUSEL" | "POLL";

export type PostPurpose = "general" | "question" | "showcase" | "service_announcement" | "opportunity";
export interface AnnouncementReference { type: "service" | "project" | "job"; id: string }
export interface CommunityLinkedRecord extends AnnouncementReference {
  title: string;
  description: string;
  category: string | null;
  status: string;
  url: string;
  owner: { id: string; displayName: string; avatarUrl: string | null; profileUrl: string | null };
  company: { id: string; name: string } | null;
  pricingMode?: string;
  budgetMode?: string;
  currency?: string;
  amountMinor?: number | null;
  minBudgetMinor?: number | null;
  maxBudgetMinor?: number | null;
}

export interface PostAuthor {
  id: string;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  role: string;
  createdAt: string;
}

/**
 * How an author is presented.
 *
 * `verified` is set only from an active company membership — the same record
 * that governs access to that company's candidates. Anything self-described
 * arrives with `verified: false` and must never be badged.
 */
export interface AuthorIdentity {
  label: string | null;
  verified: boolean;
  companyId: string | null;
  /**
   * The id `/company-profile/:id` takes, when that company has a page.
   * Not `companyId` — that is the Company row, the page is an EmployerProfile.
   */
  companyProfileId: string | null;
  companyName: string | null;
  /** Supplied only when the server can resolve an eligible professional page. */
  profileUrl?: string | null;
}

export interface PollOption {
  id: string;
  label: string;
  /** Null while results are withheld — not zero, which would be a real tally. */
  count: number | null;
}

export interface PostPoll {
  id: string;
  closesAt: string | null;
  closed: boolean;
  totalVotes: number;
  myOptionId: string | null;
  options: PollOption[];
}

export interface CommunityPost {
  purpose?: PostPurpose;
  /** Fresh, public-only canonical projection; never a stored listing snapshot. */
  linkedRecord?: CommunityLinkedRecord | null;
  linkedRecordUnavailable?: boolean;
  id: string;
  authorId: string;
  /** Server evaluates current company seats; historical authorship is insufficient. */
  canEdit?: boolean;
  content: string;
  postType: PostType;
  mediaUrls: string[];
  /**
   * A PDF shared as the post, read page by page. All three are set together,
   * or none; the page count was read from the file when it was uploaded.
   */
  documentUrl?: string | null;
  documentTitle?: string | null;
  documentPages?: number | null;
  /**
   * Times people other than its author (or its company's team) had it on
   * screen, once per person per day. Sent only to whoever may manage the post.
   */
  viewsCount?: number;
  hashtags: string[];
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
  author: PostAuthor;
  /** Null only for posts written before spaces existed. */
  space: { id: string; slug: string; name: string } | null;
  /**
   * Set when the post speaks for a company rather than for its author.
   * The author is still present — the byline names the company, and says
   * quietly who wrote it.
   */
  company: PostCompany | null;
  /**
   * The post this one passes on, embedded. One level deep, always: a reshare
   * of a reshare points at whatever was originally written.
   */
  resharedFrom: ResharedPost | null;
  /**
   * Set on TIDE posts. Only the id: the tide itself is fetched separately so
   * the join-link gate is applied once, where it lives, rather than being
   * re-implemented inside the feed query.
   */
  tideId: string | null;
  authorIdentity: AuthorIdentity;
  /**
   * Whether you follow the post's company page, and its follower count —
   * sent with the post, so a feed doesn't ask about each company afterwards.
   * Null when the company has no page to follow, or on a personal post.
   */
  companyFollow?: PersonFollowStatus | null;
  /** The same for the author of a personal post. Null on a company's. */
  authorFollow?: PersonFollowStatus | null;
  /** Present only on POLL posts. */
  poll: PostPoll | null;
  /**
   * The unfurled card for the first link, captured when the post was written.
   * `imageUrl` is our own copy, never the origin's address.
   */
  linkPreview: {
    url: string;
    title: string | null;
    description: string | null;
    siteName: string | null;
    imageUrl: string | null;
  } | null;
  /** Counted by the database, not the denormalised columns. */
  _count: { likes: number; comments: number; bookmarks: number; reshares: number };
  likedByMe: boolean;
  bookmarkedByMe: boolean;
  /** Who may comment, as the author chose. Absent on servers that predate it. */
  commentPolicy?: CommentPolicy;
  /**
   * Whether the viewer may comment or reply, from the same rule the server
   * enforces. Signed out, only "anyone" posts say yes — sign-in comes first.
   */
  canComment?: boolean;
}

/** Who may comment on a post — LinkedIn's three settings. */
export type CommentPolicy = "ANYONE" | "FOLLOWERS" | "OFF";

export const COMMENT_POLICY_LABELS: Record<CommentPolicy, string> = {
  ANYONE: "Anyone",
  FOLLOWERS: "Followers only",
  OFF: "No one",
};

export interface CommunityComment {
  id: string;
  postId: string;
  parentId: string | null;
  authorId: string;
  content: string;
  createdAt: string;
  author: PostAuthor;
  authorIdentity: AuthorIdentity;
  /** Only on top-level comments. */
  _count?: { replies: number };
  replies?: CommunityComment[];
}

export interface Paged<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

/** A display name that never renders as "null null" for a half-filled profile. */
/**
 * What the community calls someone: the one rule (`personName`), first and
 * last name, then display name. The same order the server uses in the
 * notifications it sends, so a byline and the bell agree.
 */
export function authorName(author: PostAuthor): string {
  return personName(author) || "Member";
}

/* ---------------------------------- posts --------------------------------- */

export type FeedFilter = "saved" | "liked" | "mine" | "my-spaces" | "following";

/**
 * The two sides of the community, as its nav groups posts: Showcase is people
 * offering (work and services), Opportunities is people asking (open projects
 * and live jobs). General posts and questions are on Home with everything else.
 */
export type FeedSection = "showcase" | "opportunity";

export const listPosts = (
  params: {
    page?: number;
    limit?: number;
    hashtag?: string;
    query?: string;
    spaceId?: string;
    /** One person's posts, as themselves (not what they posted for a company). */
    authorId?: string;
    /** What a company published in its own name. The Company row's id, not the page's. */
    companyId?: string;
    /** A named slice: saved, liked, mine, or my-spaces. */
    filter?: FeedFilter;
    section?: FeedSection;
    /** "top" is most liked, then most commented, across all time. */
    sort?: "new" | "top";
  } = {},
) => {
  const search = new URLSearchParams();
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));
  if (params.spaceId) search.set("spaceId", params.spaceId);
  if (params.authorId) search.set("authorId", params.authorId);
  if (params.companyId) search.set("companyId", params.companyId);
  if (params.filter) search.set("filter", params.filter);
  if (params.section) search.set("section", params.section);
  if (params.sort) search.set("sort", params.sort);
  if (params.hashtag) search.set("hashtag", params.hashtag);
  if (params.query) search.set("query", params.query);
  const qs = search.toString();
  return req<Paged<CommunityPost>>(`/posts${qs ? `?${qs}` : ""}`);
};

/**
 * How many posts a feed has gained since the newest one on screen — for the
 * "New posts" button. Takes the same slice as listPosts.
 */
export const getNewPostsCount = (
  params: { filter?: FeedFilter; section?: FeedSection; spaceId?: string },
  after: string,
) => {
  const search = new URLSearchParams({ after });
  if (params.filter) search.set("filter", params.filter);
  if (params.section) search.set("section", params.section);
  if (params.spaceId) search.set("spaceId", params.spaceId);
  return req<{ data: { count: number } }>(`/posts/new-count?${search}`).then((r) => r.data.count);
};

export const getPost = (id: string) =>
  req<{ data: CommunityPost & { comments: CommunityComment[] } }>(`/posts/${id}`).then(
    (r) => r.data,
  );

/** The quoted post inside a reshare. */
/** The company a post speaks for. */
export interface PostCompany {
  id: string;
  name: string;
  /** Its page, when it has a public one: `/community/companies/:id`. */
  profiles?: { id: string }[];
  /** Its logo, from that page; null when there is none to show. */
  logoUrl?: string | null;
}

export interface ResharedPost {
  purpose?: PostPurpose;
  linkedRecord?: CommunityLinkedRecord | null;
  linkedRecordUnavailable?: boolean;
  id: string;
  content: string;
  mediaUrls: string[];
  /**
   * A PDF shared as the post, read page by page. All three are set together,
   * or none; the page count was read from the file when it was uploaded.
   */
  documentUrl?: string | null;
  documentTitle?: string | null;
  documentPages?: number | null;
  postType: PostType;
  createdAt: string;
  /** Set when a moderator removed it; the embed says so instead of showing it. */
  removedAt: string | null;
  authorId: string;
  author: PostAuthor;
  company: PostCompany | null;
  space: { id: string; slug: string; name: string } | null;
}

/**
 * Passes a post on, with optional words of your own.
 *
 * The result is an ordinary post carrying the original, so it can be liked,
 * commented on and deleted like anything else.
 */
export const resharePost = (id: string, content?: string) =>
  req<{ data: CommunityPost }>(`/posts/${id}/reshare`, {
    method: "POST",
    body: JSON.stringify({ content }),
  }).then((r) => r.data);

export const createPost = (input: {
  purpose?: PostPurpose;
  reference?: AnnouncementReference;
  /** Absent means everyone: Home, your followers, your profile or the company's page. */
  spaceId?: string;
  content: string;
  postType?: PostType;
  mediaUrls?: string[];
  hashtags?: string[];
  /** Turns the post into a poll; the content is the question. */
  poll?: { options: string[]; closesAt?: string };
  /** A PDF from `uploadPostDocument`, shared as the post. On its own: no media or poll. */
  document?: { url: string; title: string };
  /**
   * Publish in the company's name. A request only — the server decides
   * whether the caller may, and which company, and refuses rather than
   * quietly posting as the person instead.
   */
  asCompany?: boolean;
  /** Optional company choice; the server verifies its current publishing seat. */
  companyId?: string;
  /** Who may comment. Omitted means anyone. */
  commentPolicy?: CommentPolicy;
}, expectedSupabaseId?: string) => req<{ data: CommunityPost }>("/posts", { method: "POST", body: JSON.stringify(input) }, expectedSupabaseId);

/** Changes who may comment on a post. A setting, not an edit — no "Edited" label. */
export const setCommentPolicy = (id: string, commentPolicy: CommentPolicy) =>
  req<{ data: CommunityPost }>(`/posts/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ commentPolicy }),
  }).then((r) => r.data);

/**
 * The company this person may publish for, or null.
 *
 * Owners and admins only. Everyone else posts as themselves, with the verified
 * badge that already says where they work.
 */
export const getCompanyVoice = () =>
  req<{ data: { company: CompanyVoice | null } }>("/posts/company-voice").then(
    (r) => r.data.company,
  );

/** A company this person may post as, with its page's logo (a web address, or null). */
export interface CompanyVoice {
  id: string;
  name: string;
  logoUrl: string | null;
}

/** Server filters against the caller's current identity and company seat. */
export const getAnnouncementOptions = (asCompany = false, expectedSupabaseId?: string, signal?: AbortSignal, companyId?: string) =>
  req<{ data: { services: CommunityLinkedRecord[]; projects: CommunityLinkedRecord[]; jobs: CommunityLinkedRecord[] } }>(
    `/posts/announcement-options?company=${asCompany ? "true" : "false"}${companyId ? `&companyId=${encodeURIComponent(companyId)}` : ""}`,
    { signal }, expectedSupabaseId,
  ).then((r) => r.data);

/* --------------------------------- people --------------------------------- */

/**
 * The top of someone's community page. Only what their posts already show —
 * name, photo, the line under the byline — plus the counts. `identity.profileUrl`
 * is their career profile, present only when that is public.
 */
export interface CommunityPerson {
  id: string;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  role: string;
  identity: AuthorIdentity;
  followerCount: number;
  isFollowing: boolean;
  followingCount: number;
  postCount: number;
}

/** 404 ("Person not found") for anyone who has not posted or replied. */
export const getCommunityPerson = (id: string) =>
  req<{ data: CommunityPerson }>(`/people/${id}`).then((r) => r.data);

/** Where a person's community page is: posts, followers, Follow. */
export const personPath = (id: string) => `/community/people/${id}`;

/**
 * Where a company's community page is: its posts and tides, and Follow. Keyed
 * by its page (EmployerProfile) id, the same id `/company-profile/:id` uses.
 */
export const companyPath = (profileId: string) => `/community/companies/${profileId}`;

export interface PersonFollowStatus {
  isFollowing: boolean;
  followerCount: number;
}

/** A person's follower count, and whether you follow them when signed in. */
export const getPersonFollow = (personId: string) =>
  req<{ data: PersonFollowStatus }>(`/people/${personId}/follow`).then((r) => r.data);

/** Follow or unfollow a person. Returns the new status. */
export const setPersonFollow = (personId: string, follow: boolean) =>
  req<{ data: PersonFollowStatus }>(`/people/${personId}/follow`, {
    method: follow ? "POST" : "DELETE",
  }).then((r) => r.data);

/* -------------------------------- mentions -------------------------------- */

export interface MentionSuggestions {
  /** People with a community page. Never the person asking. */
  people: Array<{ id: string; name: string; avatarUrl: string | null }>;
  /** Company pages, keyed by page id like `companyPath`. */
  companies: Array<{ id: string; name: string; logoUrl: string | null }>;
}

/** Who the "@" menu offers for what was typed after the @. */
export const suggestMentions = (q: string, signal?: AbortSignal) =>
  req<{ data: MentionSuggestions }>(`/mentions?q=${encodeURIComponent(q)}`, { signal }).then((r) => r.data);

/* ----------------------------- scheduled posts ---------------------------- */

export type ScheduledPostStatus = "SCHEDULED" | "PUBLISHING" | "PUBLISHED" | "FAILED";

/**
 * A post waiting for its time. A company's is seen by the page's owners and
 * admins; a personal one (no company) by its author alone.
 */
export interface ScheduledPost {
  id: string;
  /** Null for a post in the author's own name. */
  companyId: string | null;
  publishAt: string;
  status: ScheduledPostStatus;
  /** Why it did not go out, when it did not. */
  failureReason: string | null;
  createdAt: string;
  /** Who wrote it; the post goes out under their name, in the company's. */
  author: { id: string; name: string; avatarUrl: string | null };
  /** Stored words: mentions as tokens, as in a post. */
  content: string;
  mediaUrls: string[];
  document: { title: string; pages: number | null } | null;
  poll: { options: string[] } | null;
  spaceId: string | null;
  commentPolicy: CommentPolicy;
}

/** Everything `createPost` takes, plus when. Between 10 minutes and 90 days ahead. */
export const schedulePost = (input: Parameters<typeof createPost>[0] & { publishAt: string }, expectedSupabaseId?: string) =>
  req<{ data: ScheduledPost }>("/scheduled-posts", { method: "POST", body: JSON.stringify(input) }, expectedSupabaseId)
    .then((r) => r.data);

/** A company page's queue. Refused for anyone who does not run the page. */
export const listScheduledPosts = (companyId: string) =>
  req<{ data: ScheduledPost[] }>(`/scheduled-posts/company/${companyId}`).then((r) => r.data);

/** Your own queue: posts in your name, coming or not published. */
export const listMyScheduledPosts = () =>
  req<{ data: ScheduledPost[] }>("/scheduled-posts/mine").then((r) => r.data);

/** The cache key of your own queue; every scheduled-posts key starts the same way. */
export const MY_SCHEDULED_POSTS_KEY = (userId: string | undefined) => ["scheduled-posts", "mine", userId] as const;

/** A new time (which also retries a failed one), new words, or both. */
export const updateScheduledPost = (id: string, input: { publishAt?: string; content?: string }) =>
  req<{ data: ScheduledPost }>(`/scheduled-posts/${id}`, { method: "PATCH", body: JSON.stringify(input) }).then((r) => r.data);

export const cancelScheduledPost = (id: string) =>
  req<unknown>(`/scheduled-posts/${id}`, { method: "DELETE" });

/* -------------------------------- post stats ------------------------------- */

export interface DailyViews {
  /** "YYYY-MM-DD", UTC. */
  day: string;
  views: number;
}

/** One post's numbers, for its author or its company's page admins. */
export interface PostStats {
  postId: string;
  publishedAt: string;
  views: number;
  /** Different people, over the last `retentionDays`. */
  peopleReached: number;
  reactions: number;
  comments: number;
  reshares: number;
  /** Percent of views that led to a reaction, comment or reshare; null before any view. */
  engagementRate: number | null;
  daily: DailyViews[];
  retentionDays: number;
}

export const getPostStats = (id: string) =>
  req<{ data: PostStats }>(`/posts/${id}/stats`).then((r) => r.data);

/** A company page's recent numbers. */
export interface CompanyInsights {
  days: number;
  since: string;
  published: number;
  views: number;
  peopleReached: number;
  reactions: number;
  comments: number;
  reshares: number;
  followers: number;
  followersGained: number;
  daily: DailyViews[];
  topPosts: Array<{
    id: string;
    preview: string;
    publishedAt: string;
    /** In the window. */
    views: number;
    totalViews: number;
    reactions: number;
    comments: number;
    reshares: number;
  }>;
}

/** Null for anyone who does not run the page, so a page can ask without checking first. */
export const getCompanyInsights = (companyId: string, days = 30) =>
  req<{ data: CompanyInsights | null }>(`/company-pages/${companyId}/insights?days=${days}`).then((r) => r.data);

/** Posts the reader had on screen. The server decides what counts. */
export const recordPostViews = (postIds: string[]) =>
  req<{ data: { counted: number } }>("/post-views", { method: "POST", body: JSON.stringify({ postIds }), keepalive: true });

/* ---------------------------------- polls --------------------------------- */

export const votePoll = (pollId: string, optionId: string) =>
  req<{ data: PostPoll }>(`/polls/${pollId}/vote`, {
    method: "POST",
    body: JSON.stringify({ optionId }),
  }).then((r) => r.data);

export const unvotePoll = (pollId: string) =>
  req<{ data: PostPoll }>(`/polls/${pollId}/vote`, { method: "DELETE" }).then((r) => r.data);

/* ----------------------------------- gifs --------------------------------- */

export interface GifResult {
  id: string;
  previewUrl: string;
  url: string;
  description: string;
  width: number;
  height: number;
}

/** Whether GIF search is configured, so the button can be hidden rather than fail. */
export const getGifStatus = () =>
  req<{ data: { available: boolean } }>("/gifs/status").then((r) => r.data.available);

export const searchGifs = (q: string) =>
  req<{ data: GifResult[] }>(`/gifs/search?q=${encodeURIComponent(q)}`).then((r) => r.data);

/** Copies the chosen GIF into our storage and returns our own URL. */
export const adoptGif = (url: string) =>
  req<{ data: { url: string; path: string } }>("/gifs/adopt", {
    method: "POST",
    body: JSON.stringify({ url }),
  }).then((r) => r.data);

export const updatePost = (id: string, content: string, structured?: { purpose?: PostPurpose; reference?: AnnouncementReference | null }) =>
  req<{ data: CommunityPost }>(`/posts/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ content, ...structured }),
  });

export const deletePost = (id: string) => req<unknown>(`/posts/${id}`, { method: "DELETE" });

/**
 * Like and unlike are separate verbs server-side, so the caller states which
 * it means rather than sending a toggle the server has to interpret. Two rapid
 * clicks then converge on the state the user last chose.
 */
export const likePost = (id: string) => req<unknown>(`/posts/${id}/like`, { method: "POST" });
export const unlikePost = (id: string) => req<unknown>(`/posts/${id}/like`, { method: "DELETE" });

export const bookmarkPost = (id: string) =>
  req<unknown>(`/posts/${id}/bookmark`, { method: "POST" });
export const unbookmarkPost = (id: string) =>
  req<unknown>(`/posts/${id}/bookmark`, { method: "DELETE" });

/* ---------------------------------- media --------------------------------- */

/**
 * Uploads one image or short video and returns its URL.
 *
 * Not JSON, so the shared `req` helper is bypassed — it sets a JSON content
 * type, and letting the browser set its own multipart boundary is the only way
 * this parses server-side.
 */
export type MediaKind = "image" | "video";

export async function uploadPostMedia(
  file: File,
  signal?: AbortSignal,
): Promise<{ url: string; path: string; kind: MediaKind }> {
  const { data: { session } } = await supabase.auth.getSession();
  const body = new FormData();
  // Pictures at the size a feed shows them; videos and GIFs as they are.
  body.append("file", await fitImage(file, IMAGE_SIZES.post));
  signal?.throwIfAborted();

  const res = await fetch(`${API_BASE_URL}/community/posts/media`, {
    method: "POST",
    headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
    body,
    signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || "Upload failed");
  }
  return (await res.json()).data;
}

/** What the server tells us about an uploaded PDF. */
export interface UploadedDocument {
  url: string;
  path: string;
  /** Read from the file by the server. */
  pages: number;
  /** From the file's name; the writer can change it before posting. */
  title: string;
}

/** Uploads one PDF to share as a document post. Up to 15MB and 300 pages. */
export async function uploadPostDocument(file: File): Promise<UploadedDocument> {
  const { data: { session } } = await supabase.auth.getSession();
  const body = new FormData();
  body.append("file", file);

  const res = await fetch(`${API_BASE_URL}/community/posts/documents`, {
    method: "POST",
    headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
    body,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || "Upload failed");
  }
  return (await res.json()).data;
}

/**
 * Whether a stored media URL is a video.
 *
 * Decided by extension rather than a regex over the whole URL: the server
 * names every upload from the format it verified, so the suffix is as reliable
 * as anything the client could re-derive, and query strings on signed or
 * cache-busted URLs do not confuse it.
 */
export function isVideoUrl(url: string): boolean {
  if (isStreamUrl(url)) return true;
  try {
    const path = new URL(url).pathname.toLowerCase();
    return path.endsWith(".mp4") || path.endsWith(".webm");
  } catch {
    return false;
  }
}

/* ------------------------------- long videos ------------------------------ */

/**
 * A streamed video (Mux): how a post names a long video. Exactly this shape,
 * which the server also insists on before a post may carry one.
 */
const STREAM_URL = /^https:\/\/stream\.mux\.com\/([A-Za-z0-9]{1,128})\.m3u8$/;

export const isStreamUrl = (url: string): boolean => STREAM_URL.test(url);

/** A still of a streamed video, a second in — or null for any other URL. */
export function streamPosterUrl(url: string, width = 960): string | null {
  const id = STREAM_URL.exec(url)?.[1];
  return id ? `https://image.mux.com/${id}/thumbnail.webp?width=${width}&time=1` : null;
}

/** Whether long videos are switched on here, and how long one may be. */
export interface VideoUploadSettings {
  enabled: boolean;
  maxSeconds: number;
}

export const getVideoUploadSettings = () =>
  req<{ data: VideoUploadSettings }>("/videos/status").then((r) => r.data);

/** A long video on its way to being postable, as the server reads it from Mux. */
export interface CommunityVideo {
  id: string;
  status: "uploading" | "processing" | "ready" | "failed";
  /** What the post names it by, once it streams. */
  url: string | null;
  posterUrl: string | null;
  durationSeconds: number | null;
  aspectRatio: string | null;
  failureReason: string | null;
}

/** An upload address for one file: the browser sends the video there, not to us. */
export const startVideoUpload = () =>
  req<{ data: { id: string; uploadUrl: string } }>("/videos", { method: "POST" }).then((r) => r.data);

export const getCommunityVideo = (id: string) =>
  req<{ data: CommunityVideo }>(`/videos/${id}`).then((r) => r.data);

/** Out of the draft, and deleted. Refused once a post shows it. */
export const discardCommunityVideo = (id: string) =>
  req<unknown>(`/videos/${id}`, { method: "DELETE" });

/* -------------------------------- comments -------------------------------- */

export type CommentSort = "newest" | "oldest" | "replies";

export const listComments = (postId: string, sort: CommentSort = "newest", page = 1) =>
  req<Paged<CommunityComment>>(`/posts/${postId}/comments?sort=${sort}&page=${page}`);

export const addComment = (postId: string, content: string, parentId?: string) =>
  req<{ data: CommunityComment }>(`/posts/${postId}/comments`, {
    method: "POST",
    body: JSON.stringify({ content, ...(parentId ? { parentId } : {}) }),
  });

export const deleteComment = (postId: string, commentId: string) =>
  req<unknown>(`/posts/${postId}/comments/${commentId}`, { method: "DELETE" });

/* ------------------------------- moderation ------------------------------- */

export type ReportStatus = "OPEN" | "ACTIONED" | "DISMISSED";

export interface ModerationReport {
  id: string;
  reason: string;
  detail: string | null;
  createdAt: string;
  status: ReportStatus;
  target:
    | { kind: "post"; id: string; content: string; removed: boolean }
    | { kind: "comment"; id: string; postId: string; content: string; removed: boolean }
    | null;
}

const mod = <T>(path: string, init?: RequestInit) => req<{ data: T }>(`/moderation${path}`, init).then((r) => r.data);

/** The closed list, served so the UI cannot offer a reason the server rejects. */
export const getReportReasons = () =>
  mod<{ reasons: string[] }>("/reasons").then((r) => r.reasons);

export const reportPost = (postId: string, reason: string, detail?: string) =>
  mod<{ reported: boolean }>(`/posts/${postId}/report`, {
    method: "POST",
    body: JSON.stringify({ reason, detail }),
  });

export const reportComment = (commentId: string, reason: string, detail?: string) =>
  mod<{ reported: boolean }>(`/comments/${commentId}/report`, {
    method: "POST",
    body: JSON.stringify({ reason, detail }),
  });

export const listReports = (status: ReportStatus = "OPEN") =>
  mod<ModerationReport[]>(`/reports?status=${status}`);

export const removeReportedPost = (postId: string, reason: string) =>
  mod<unknown>(`/posts/${postId}/remove`, { method: "POST", body: JSON.stringify({ reason }) });

export const removeReportedComment = (commentId: string) =>
  mod<unknown>(`/comments/${commentId}/remove`, { method: "POST" });

export const dismissReport = (reportId: string, resolution?: string) =>
  mod<unknown>(`/reports/${reportId}/dismiss`, {
    method: "POST",
    body: JSON.stringify({ resolution }),
  });

/* --------------------------------- helpers -------------------------------- */

/** "Ada Lovelace" → "AL". Shared by every avatar fallback in the community. */
export function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

/** The address a post can be shared by. */
export const postUrl = (id: string) => `${window.location.origin}/community/posts/${id}`;

export function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
