/**
 * Which side of the community someone is looking from, as on Behance: one
 * account, two views of it. Someone can offer their work and also hire, so this
 * is a view and never an account type. It decides what the profile menu shows,
 * and the server decides what they may do.
 */
export type CommunityView = "freelancer" | "client";

export interface ViewingAsFacts {
  /** The provider area is for job seeker and freelancer accounts only. */
  canOfferServices: boolean;
  /** Holds a seat on a company team, so is more likely here to hire. */
  hasCompany: boolean;
}

export const VIEW_LABELS: Record<CommunityView, string> = { freelancer: "Freelancer", client: "Client" };

/** The tab with what each side came for: clients look for people, freelancers for work. */
export const VIEW_LANDING: Record<CommunityView, string> = {
  client: "/community?view=showcase",
  freelancer: "/community?view=opportunity",
};

export const otherView = (view: CommunityView): CommunityView => (view === "client" ? "freelancer" : "client");

/** Someone who can't offer services is a client, whatever is stored; otherwise their choice stands. */
export function viewingAs(stored: string | null, { canOfferServices, hasCompany }: ViewingAsFacts): CommunityView {
  if (!canOfferServices) return "client";
  if (stored === "freelancer" || stored === "client") return stored;
  return hasCompany ? "client" : "freelancer";
}

/** What the marketplace pages show when the address doesn't say. */
const PAGE_DEFAULTS: Record<string, string> = { kind: "service", box: "incoming" };

/**
 * Which of these links the page you're on belongs to, for lighting a row.
 * The most specific one wins, so Saved professionals lights alone on its page
 * though it sits under Find professionals, and a professional's own page still
 * lights Find professionals. A link's `?kind=` or `?box=` has to match too.
 */
export function activeLink(links: string[], pathname: string, search: string): string | null {
  const current = new URLSearchParams(search);
  const fits = links.filter((link) => {
    const [path, query] = link.split("?");
    if (pathname !== path && !pathname.startsWith(`${path}/`)) return false;
    return [...new URLSearchParams(query)].every(([key, value]) => (current.get(key) ?? PAGE_DEFAULTS[key]) === value);
  });
  return fits.sort((a, b) => b.length - a.length)[0] ?? null;
}

const storageKey = (userId: string) => `coral.community.viewingAs.${userId}`;

/** Per person and per browser. Without storage the view just starts from its default. */
export function readViewingAs(userId: string): string | null {
  try {
    return localStorage.getItem(storageKey(userId));
  } catch {
    return null;
  }
}

export function rememberViewingAs(userId: string, view: CommunityView): void {
  try {
    localStorage.setItem(storageKey(userId), view);
  } catch {
    // Storage refused; the choice still holds for this visit.
  }
}
