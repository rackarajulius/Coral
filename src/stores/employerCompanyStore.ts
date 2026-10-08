import { create } from "zustand";
import { EmployerCompany, getMyCompany } from "@/lib/api/employerCompany";
import { cachedUserId } from "@/contexts/AuthContext";
import { onAfterSignOut } from "@/lib/signOutHooks";

/**
 * The name onboarding writes before anyone has chosen one. Not a company name,
 * so nothing should print it or cache it.
 */
export const isNamed = (name: string | null | undefined): boolean =>
  !!name && name !== "New Company";

/**
 * The few fields the dashboard paints before anything is fetched.
 *
 * Only these three: the full company record carries gallery photos, DEI stats
 * and award lists, none of which the first paint needs and none of which
 * belongs in localStorage just to avoid a flash.
 */
export interface CompanyIdentity {
  companyName: string;
  tagline: string | null;
  companyBanner: string | null;
}

interface CachedIdentity extends CompanyIdentity {
  /**
   * Whose company this is. A shared browser signs one person out and the next
   * one in without a reload, and a cache without this would paint the previous
   * company's name into their dashboard while their own fetch was in flight.
   * Sign-out clears it too; this is the guard for the sign-out that never ran.
   */
  userId: string;
}

const CACHE_KEY = "employer:company-identity:v1";

const toIdentity = (c: EmployerCompany): CompanyIdentity | null =>
  isNamed(c.companyName)
    ? { companyName: c.companyName, tagline: c.tagline, companyBanner: c.companyBanner }
    : null;

const readCached = (): CompanyIdentity | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedIdentity;
    const owner = cachedUserId();
    // No signed-in user, or a different one: this is not theirs to see.
    if (!owner || cached.userId !== owner) return null;
    return isNamed(cached.companyName)
      ? {
          companyName: cached.companyName,
          tagline: cached.tagline ?? null,
          companyBanner: cached.companyBanner ?? null,
        }
      : null;
  } catch {
    return null;
  }
};

const writeCached = (identity: CompanyIdentity | null): void => {
  try {
    const owner = cachedUserId();
    if (!identity || !owner) localStorage.removeItem(CACHE_KEY);
    else localStorage.setItem(CACHE_KEY, JSON.stringify({ ...identity, userId: owner }));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
};

interface EmployerCompanyState {
  company: EmployerCompany | null;
  /**
   * What to paint now: last known until the fetch lands, then the real thing.
   * Null means genuinely unnamed — which the dashboard shows honestly rather
   * than guessing.
   */
  identity: CompanyIdentity | null;
  loading: boolean;
  loaded: boolean;
  fetchCompany: () => Promise<void>;
  setCompany: (company: EmployerCompany) => void;
  forgetIdentity: () => void;
}

export const useEmployerCompanyStore = create<EmployerCompanyState>((set) => ({
  company: null,
  // Read synchronously at store creation, so a returning employer's own
  // company name is on screen in the first paint instead of "Your dashboard"
  // appearing for a second and then being replaced.
  identity: readCached(),
  loading: false,
  loaded: false,
  fetchCompany: async () => {
    set({ loading: true });
    try {
      const company = await getMyCompany();
      const identity = toIdentity(company);
      set({ company, identity, loading: false, loaded: true });
      writeCached(identity);
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },
  setCompany: (company) => {
    const identity = toIdentity(company);
    set({ company, identity, loaded: true });
    writeCached(identity);
  },
  forgetIdentity: () => {
    writeCached(null);
    set({ company: null, identity: null, loaded: false });
  },
}));

// Registered here rather than in a component: the cache outlives any screen
// that reads it, so forgetting it cannot depend on one being mounted.
onAfterSignOut(() => useEmployerCompanyStore.getState().forgetIdentity());
