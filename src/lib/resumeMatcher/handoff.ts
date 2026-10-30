import type { MatchSearch } from "../api/resumeMatcher";

export const MATCHER_PATH = "/resume-matcher";

/** Explicitly choosing free matches must not immediately reopen the pricing popup. */
export const FREE_MATCHER_STATE = { continueWithFreeMatches: true } as const;

/** A search started somewhere else (Find Jobs, the home page) and carried to Job Match. */
export interface MatcherHandoff {
  query?: string;
  location?: string;
  remote?: boolean;
}

/** Find Jobs takes "Remote" as a place; Job Match has a workplace filter for it. */
const REMOTE_PLACE = /^\s*remote\s*$/i;

/**
 * The link to Job Match for a search. `where` is left out when no place was
 * given, so Job Match searches around the person's own city, as it does when
 * opened plainly; an empty `where` means anywhere in their country.
 */
export function matcherPath(h: MatcherHandoff = {}): string {
  const params = new URLSearchParams();
  const query = h.query?.trim();
  const location = h.location?.trim();
  const remote = !!h.remote || (!!location && REMOTE_PLACE.test(location));
  if (query) params.set("q", query);
  // Remote work isn't anywhere in particular.
  if (remote) params.set("where", "");
  else if (location) params.set("where", location);
  if (remote) params.set("workplace", "remote");
  const qs = params.toString();
  return qs ? `${MATCHER_PATH}?${qs}` : MATCHER_PATH;
}

/**
 * The search a Job Match link asks for. No `search` when the link names
 * nothing, so the page matches the profile as it stands.
 */
export function readMatcherHandoff(params: URLSearchParams): { search?: MatchSearch; remote: boolean } {
  const query = params.get("q")?.trim() || undefined;
  const where = params.get("where");
  const countryCode = params.get("country")?.trim().toUpperCase() || undefined;
  const remote = params.get("workplace") === "remote";
  if (!query && where === null) return { remote };
  return {
    search: {
      query,
      // null: the link named no place, so the profile's city.
      location: where === null ? undefined : where.trim(),
      countryCode: where === null ? undefined : countryCode,
    },
    remote,
  };
}

/** The link parameters for a search run on the page, so a reload repeats it. */
export function handoffParams(search: MatchSearch, remote: boolean): URLSearchParams {
  const params = new URLSearchParams();
  if (search.query) params.set("q", search.query);
  if (search.location !== undefined) params.set("where", search.location);
  if (search.location && search.countryCode) params.set("country", search.countryCode);
  if (remote) params.set("workplace", "remote");
  return params;
}
