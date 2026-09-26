const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

/**
 * Events the browser reports. Job and profile *views* are captured server-side
 * when the page's data is fetched, so they aren't here — these are the two
 * intent signals that only exist in the client.
 */
export type ClientEvent = "apply_click" | "apply_started" | "page_source";

/**
 * Records an analytics event. Fire-and-forget: never awaited, never throws,
 * and never blocks what the user was actually doing.
 *
 * Uses `sendBeacon` when available so the request survives the navigation that
 * often follows immediately — an external "Apply" click opens a new tab, and a
 * normal fetch can be cancelled before it leaves.
 *
 * Note it sends no employer id: the server resolves that from the job, so a
 * tampered payload can't credit or pollute someone else's numbers.
 */
export function trackEvent(
  type: ClientEvent,
  payload: {
    jobId?: string;
    companyUserId?: string;
    referrer?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    timezone?: string;
  } = {},
): void {
  try {
    const url = `${API_BASE_URL}/analytics/events`;
    const body = JSON.stringify({ type, ...payload });

    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      // Beacons must be a Blob to carry a JSON content type.
      navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
      return;
    }

    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Analytics must never surface an error to the person using the app.
  }
}

/**
 * Where this visit came from, captured at first landing.
 *
 * `document.referrer` is the only place the true external source exists. The
 * API can't read it: for a single-page app, the `Referer` header on a fetch is
 * our own page URL, so server-side capture records us as the source of our own
 * traffic.
 *
 * The referrer is also only correct on the FIRST page of a visit — after a
 * client-side route change it still reports the original document, but UTM
 * params are gone from the URL. So both are stashed on first load and reused.
 */
const SOURCE_KEY = "coral:source";

interface StoredSource {
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

function readStoredSource(): StoredSource {
  try {
    const raw = sessionStorage.getItem(SOURCE_KEY);
    if (raw) return JSON.parse(raw) as StoredSource;

    const params = new URLSearchParams(window.location.search);
    const referrer = document.referrer || "";
    // Ignore our own domain: an internal navigation isn't a traffic source.
    const external = referrer && !referrer.includes(window.location.host) ? referrer : "";

    const source: StoredSource = {
      ...(external ? { referrer: external } : {}),
      ...(params.get("utm_source") ? { utmSource: params.get("utm_source") as string } : {}),
      ...(params.get("utm_medium") ? { utmMedium: params.get("utm_medium") as string } : {}),
      ...(params.get("utm_campaign") ? { utmCampaign: params.get("utm_campaign") as string } : {}),
    };
    sessionStorage.setItem(SOURCE_KEY, JSON.stringify(source));
    return source;
  } catch {
    return {};
  }
}

/**
 * Reports the visit's source once per employer per session.
 *
 * Once per employer, not once per page: the breakdown counts visits to *your*
 * pages, and firing on every job someone opens would make whichever channel
 * sends the most curious browsers look like the biggest channel.
 */
export function trackPageSource(target: { jobId?: string; companyUserId?: string }): void {
  const key = target.jobId ?? target.companyUserId;
  if (!key) return;
  try {
    const seenKey = `${SOURCE_KEY}:sent:${key}`;
    if (sessionStorage.getItem(seenKey)) return;
    sessionStorage.setItem(seenKey, "1");
    // Timezone gives a continent-level region when the deployment isn't behind
    // a CDN that resolves country at the edge. Coarse, but it needs no IP
    // lookup and no third-party service.
    let timezone: string | undefined;
    try {
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
    } catch {
      timezone = undefined;
    }
    trackEvent("page_source", { ...target, ...readStoredSource(), timezone });
  } catch {
    // sessionStorage can throw in private modes — losing an event is fine.
  }
}
