const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

/** A city to suggest, as the server describes it. */
export interface CitySuggestion {
  name: string;
  /** Province or state: "Ontario". */
  region?: string;
  /** Short form, for Canada and the US: "ON". */
  regionCode?: string;
  /** ISO 3166 code: "CA". */
  countryCode: string;
  country: string;
  /** How it is written in a search: "Toronto, ON", "Kampala, Uganda". */
  label: string;
}

/**
 * City suggestions for what has been typed. Public — no sign-in needed.
 * A failure gives no suggestions rather than an error: the box still takes
 * whatever is typed.
 */
export async function searchCities(q: string, near?: string, signal?: AbortSignal): Promise<CitySuggestion[]> {
  const params = new URLSearchParams({ q, limit: "8" });
  if (near) params.set("near", near);
  const res = await fetch(`${API_BASE_URL}/locations/cities?${params.toString()}`, { signal });
  if (!res.ok) return [];
  const json = await res.json();
  return (json.data ?? []) as CitySuggestion[];
}
