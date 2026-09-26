import supabase from "@/lib/supabase";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

export type TideMode = "ONLINE" | "IN_PERSON" | "HYBRID";
export type TideRsvp = "GOING" | "INTERESTED";

export interface Tide {
  id: string;
  title: string;
  description: string | null;
  /** Set when a company is holding it. */
  company: { id: string; name: string } | null;
  /** Always present — someone is accountable for every tide. */
  host: {
    id: string;
    displayName: string | null;
    firstName: string | null;
    lastName: string | null;
    avatarUrl: string | null;
  };
  /** The instant, in UTC. Pair it with `timezone` to show the host's clock. */
  startsAt: string;
  endsAt: string | null;
  /** The host's IANA zone, e.g. "Africa/Kampala". */
  timezone: string;
  mode: TideMode;
  /** A venue or a platform name. Public. */
  location: string | null;
  bannerUrl: string | null;
  capacity: number | null;
  canceledAt: string | null;
  cancelReason: string | null;
  goingCount: number;
  /** What the current reader said, if anything. */
  myRsvp: TideRsvp | null;
  /**
   * The actual way in. Only ever present for someone going, within an hour of
   * the start — the server withholds it rather than nulling it, so a listing
   * cannot leak it.
   */
  joinUrl: string | null;
  /** True when a way in exists but it is not time yet. */
  joinOpensLater: boolean;
}

interface Paged<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

async function authHeaders(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  };
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}/community/tides${path}`, {
    ...init,
    headers: { ...(await authHeaders()), ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || "Something went wrong");
  }
  return (await res.json()) as T;
}

/** What is coming up. Public; the viewer's own answer is added when signed in. */
export const listTides = (opts: { companyId?: string; past?: boolean; page?: number; limit?: number } = {}) => {
  const q = new URLSearchParams();
  if (opts.companyId) q.set("companyId", opts.companyId);
  if (opts.past) q.set("past", "true");
  if (opts.page) q.set("page", String(opts.page));
  if (opts.limit) q.set("limit", String(opts.limit));
  const qs = q.toString();
  return req<Paged<Tide>>(qs ? `?${qs}` : "");
};

export const getTide = (id: string) => req<{ data: Tide }>(`/${id}`).then((r) => r.data);

/**
 * Holds a tide, and announces it in the same breath when a space is given.
 *
 * One call rather than two: a tide created without its announcement is one
 * nobody was told about, which looks to the host like nothing happened.
 */
export const createTide = (input: {
  title: string;
  description?: string;
  /** UTC instant. */
  startsAt: string;
  endsAt?: string;
  /** IANA zone the times were chosen in. */
  timezone: string;
  mode: TideMode;
  location?: string;
  joinUrl?: string;
  capacity?: number;
  asCompany?: boolean;
  spaceId?: string;
  announcement?: string;
}) => req<{ data: Tide }>("", { method: "POST", body: JSON.stringify(input) }).then((r) => r.data);

export const rsvpTide = (id: string, status: TideRsvp) =>
  req<{ data: unknown }>(`/${id}/rsvp`, { method: "POST", body: JSON.stringify({ status }) });

export const withdrawFromTide = (id: string) =>
  req<{ data: unknown }>(`/${id}/rsvp`, { method: "DELETE" });

/**
 * Where the calendar file lives.
 *
 * A plain link, not a fetch: handing the browser a URL lets it download the
 * file the way it downloads anything, and .ics is understood by Outlook,
 * Google and Apple without anyone connecting an account.
 *
 * It carries a link to the tide page, never the join URL — someone can add
 * this to their calendar days before the way in is released.
 */
export const tideCalendarUrl = (id: string) =>
  `${API_BASE_URL}/community/tides/${id}/calendar.ics`;

/* -------------------------------------------------------------------------- */
/*  Showing a time that means something                                       */
/* -------------------------------------------------------------------------- */

const fmt = (iso: string, timeZone: string, opts: Intl.DateTimeFormatOptions) => {
  try {
    return new Intl.DateTimeFormat(undefined, { ...opts, timeZone }).format(new Date(iso));
  } catch {
    // An unknown zone should cost the reader a label, not the whole card.
    return new Intl.DateTimeFormat(undefined, opts).format(new Date(iso));
  }
};

/** "Thu 8 Oct, 2:00 pm" in the host's zone. */
export const tideWhen = (tide: Pick<Tide, "startsAt" | "timezone">) =>
  fmt(tide.startsAt, tide.timezone, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

/**
 * The same instant on the reader's own clock, when that differs.
 *
 * Returns null when the reader is in the host's zone, because "2:00 pm your
 * time" under "2:00 pm" is noise.
 */
export const tideWhenYours = (tide: Pick<Tide, "startsAt" | "timezone">): string | null => {
  const mine = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!mine || mine === tide.timezone) return null;
  const opts: Intl.DateTimeFormatOptions = {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  };
  const theirs = fmt(tide.startsAt, tide.timezone, opts);
  const yours = new Intl.DateTimeFormat(undefined, opts).format(new Date(tide.startsAt));
  return yours === theirs ? null : yours;
};

export const MODE_LABEL: Record<TideMode, string> = {
  ONLINE: "Online",
  IN_PERSON: "In person",
  HYBRID: "Online and in person",
};
