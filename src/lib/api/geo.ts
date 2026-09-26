const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

/**
 * ISO-2 country the edge resolved for this request, or null.
 *
 * Deliberately the only geolocation the client asks for. The browser never
 * contacts a third-party IP service — that leaked every visitor's address to
 * an outside party, and it is also the lookup the backend's `geo.ts` decided
 * against buying. Null is the normal answer in local development, where there
 * is no CDN in front.
 */
export async function getCountryHint(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/geo/hint`);
    if (!res.ok) return null;
    const json = await res.json();
    const code = json?.data?.country;
    return typeof code === "string" && /^[A-Z]{2}$/.test(code) ? code : null;
  } catch {
    // A hint is a convenience; failing to get one is not an error worth showing.
    return null;
  }
}
