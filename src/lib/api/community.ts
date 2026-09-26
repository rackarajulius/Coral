import supabase from "@/lib/supabase";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
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
  return res.json() as Promise<T>;
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

export type PostType =
  | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "JOB" | "CAROUSEL" | "POLL";

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
  id: string;
  authorId: string;
  content: string;
  postType: PostType;
  mediaUrls: string[];
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
  company: { id: string; name: string } | null;
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
}

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

interface Paged<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

/** A display name that never renders as "null null" for a half-filled profile. */
export function authorName(author: PostAuthor): string {
  return (
    author.displayName?.trim() ||
    [author.firstName, author.lastName].filter(Boolean).join(" ").trim() ||
    "Member"
  );
}

/* ---------------------------------- posts --------------------------------- */

export type FeedFilter = "saved" | "liked" | "mine" | "my-spaces";

export const listPosts = (
  params: {
    page?: number;
    hashtag?: string;
    query?: string;
    spaceId?: string;
    /** A named slice: saved, liked, mine, or my-spaces. */
    filter?: FeedFilter;
  } = {},
) => {
  const search = new URLSearchParams();
  if (params.page) search.set("page", String(params.page));
  if (params.spaceId) search.set("spaceId", params.spaceId);
  if (params.filter) search.set("filter", params.filter);
  if (params.hashtag) search.set("hashtag", params.hashtag);
  if (params.query) search.set("query", params.query);
  const qs = search.toString();
  return req<Paged<CommunityPost>>(`/posts${qs ? `?${qs}` : ""}`);
};

export const getPost = (id: string) =>
  req<{ data: CommunityPost & { comments: CommunityComment[] } }>(`/posts/${id}`).then(
    (r) => r.data,
  );

/** The quoted post inside a reshare. */
export interface ResharedPost {
  id: string;
  content: string;
  mediaUrls: string[];
  postType: PostType;
  createdAt: string;
  /** Set when a moderator removed it; the embed says so instead of showing it. */
  removedAt: string | null;
  authorId: string;
  author: PostAuthor;
  company: { id: string; name: string } | null;
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
  spaceId: string;
  content: string;
  postType?: PostType;
  mediaUrls?: string[];
  hashtags?: string[];
  /** Turns the post into a poll; the content is the question. */
  poll?: { options: string[]; closesAt?: string };
  /**
   * Publish in the company's name. A request only — the server decides
   * whether the caller may, and which company, and refuses rather than
   * quietly posting as the person instead.
   */
  asCompany?: boolean;
}) => req<{ data: CommunityPost }>("/posts", { method: "POST", body: JSON.stringify(input) });

/**
 * The company this person may publish for, or null.
 *
 * Owners and admins only. Everyone else posts as themselves, with the verified
 * badge that already says where they work.
 */
export const getCompanyVoice = () =>
  req<{ data: { company: { id: string; name: string } | null } }>("/posts/company-voice").then(
    (r) => r.data.company,
  );

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

export const updatePost = (id: string, content: string) =>
  req<{ data: CommunityPost }>(`/posts/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ content }),
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
): Promise<{ url: string; path: string; kind: MediaKind }> {
  const { data: { session } } = await supabase.auth.getSession();
  const body = new FormData();
  body.append("file", file);

  const res = await fetch(`${API_BASE_URL}/community/posts/media`, {
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
  try {
    const path = new URL(url).pathname.toLowerCase();
    return path.endsWith(".mp4") || path.endsWith(".webm");
  } catch {
    return false;
  }
}

/* -------------------------------- comments -------------------------------- */

export type CommentSort = "newest" | "oldest" | "replies";

export const listComments = (postId: string, sort: CommentSort = "newest") =>
  req<Paged<CommunityComment>>(`/posts/${postId}/comments?sort=${sort}`);

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
