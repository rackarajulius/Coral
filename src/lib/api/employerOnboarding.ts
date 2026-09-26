import supabase from "@/lib/supabase";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

async function authHeaders(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  };
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}/employers/${path}`, {
    ...init,
    headers: await authHeaders(),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message || "Request failed");
  }
  return (await res.json()).data as T;
}

export interface OnboardingState {
  status: string;
  needsOnboarding: boolean;
  steps: { company: boolean; publicFace: boolean; verification: boolean };
  /**
   * Which step to resume on, or "done" when nothing is outstanding. Derived
   * server-side from the profile, so it's the same on every device.
   */
  next: "company" | "publicFace" | "done";
  /** Null for free-mail addresses; they can't identify a company. */
  workDomain: string | null;
  profile: Record<string, unknown> | null;
}

/** A company the signed-in employer may already belong to. */
export interface CompanyMatch {
  profileId: string;
  companyId: string | null;
  companyName: string | null;
  companyLogo: string | null;
  website: string | null;
  industry: string | null;
  headquarters: string | null;
  /** The domain this matched on — never proof of employment. */
  matchedOn: string;
}

export interface CompanyStepInput {
  companyName: string;
  companyWebsite?: string;
  companySize?: string;
  industry?: string;
  headquarters?: string;
  isRecruiter?: boolean;
  isHiringManager?: boolean;
  isAdmin?: boolean;
  joinCompanyId?: string;
}

export const getOnboardingState = () => req<OnboardingState>("me/onboarding");

export const getCompanyMatches = () =>
  req<{ domain: string | null; matches: CompanyMatch[] }>("me/onboarding/matches");

/**
 * `joinPending` is true when the employer asked to join an existing company.
 * Nothing is granted at that point — an owner or admin has to approve, because
 * a shared email domain is a hint about where someone works, not proof.
 */
export const saveCompanyStep = (input: CompanyStepInput) =>
  req<OnboardingState & { joinPending?: boolean }>("me/onboarding/company", {
    method: "POST",
    body: JSON.stringify(input),
  });

export const completeOnboarding = () =>
  req<OnboardingState>("me/onboarding/complete", { method: "POST" });

export const COMPANY_SIZES = [
  "1-10",
  "11-50",
  "51-200",
  "201-500",
  "501-1000",
  "1000+",
];

export const INDUSTRIES = [
  "Technology",
  "Finance",
  "Healthcare",
  "Education",
  "Marketing",
  "Retail",
  "Manufacturing",
  "Logistics",
  "Hospitality",
  "Construction",
  "Legal",
  "Non-profit",
  "Other",
];

/* ------------------------------ verification ------------------------------ */

export interface VerificationState {
  level: "unverified" | "domain_verified" | "verified";
  /** Whether posting jobs and contacting candidates is permitted. */
  canReachCandidates: boolean;
  workDomain: string | null;
  companyWebsite: string | null;
  /** True when the instant domain check would succeed right now. */
  canAutoVerify: boolean;
  /** Free-mail addresses can't domain-verify; they need manual review. */
  needsDocuments: boolean;
  /** What to do next; null once verified. */
  reason: string | null;
}

export const getVerification = () => req<VerificationState>("me/verification");

export const verifyByDomain = () =>
  req<VerificationState>("me/verification/domain", { method: "POST" });

/**
 * Company document verification — the route for anyone whose email domain
 * can't be matched automatically.
 *
 * Two calls because the file and the request are separate endpoints: upload
 * first, then submit the request referencing the stored path.
 */
export async function uploadVerificationDocument(file: File): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE_URL}/verifications/document`, {
    method: "POST",
    headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message || "Couldn't upload that file");
  }
  return (await res.json()).data.documentUrl as string;
}

export async function requestCompanyVerification(input: {
  documentUrl: string;
  note?: string;
}): Promise<{ id: string; status: string }> {
  const res = await fetch(`${API_BASE_URL}/verifications`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ type: "COMPANY", ...input }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message || "Couldn't submit for review");
  }
  return (await res.json()).data;
}
