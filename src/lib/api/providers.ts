import supabase from "@/lib/supabase";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

export const PROVIDER_CATEGORIES = [
  { value: "design", label: "Design" },
  { value: "marketing", label: "Marketing" },
  { value: "software", label: "Software" },
] as const;

export type ProviderCategory = (typeof PROVIDER_CATEGORIES)[number]["value"];
export type ProviderWorkPreference = "contract" | "project" | "consulting";

export const PROVIDER_WORK_PREFERENCES: { value: ProviderWorkPreference; label: string }[] = [
  { value: "project", label: "Project work" },
  { value: "contract", label: "Contract work" },
  { value: "consulting", label: "Consulting" },
];

export interface ProviderIdentity {
  id: string;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
}

/** Only the evidence and preferences a provider has chosen to make public. */
export interface PublicProviderProfile {
  userId: string;
  headline: string | null;
  summary: string | null;
  title: string | null;
  category: ProviderCategory | null;
  skills: string[];
  expertise: string[];
  country: string | null;
  city: string | null;
  timezone: string | null;
  availableForRemote: boolean;
  availability: string | null;
  hoursPerWeek: number | null;
  workPreferences: ProviderWorkPreference[];
  portfolioUrl: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  user: ProviderIdentity;
}

export interface OwnerProviderProfile extends PublicProviderProfile {
  id: string;
  providerEnabled: boolean;
  publicPreviewEnabled: boolean;
  updatedAt?: string;
  readiness?: { ready: boolean; missingFields: string[] };
}

export interface UpdateProviderProfile {
  providerEnabled?: boolean;
  publicPreviewEnabled?: boolean;
  category?: ProviderCategory | null;
  headline?: string | null;
  summary?: string | null;
  title?: string | null;
  skills?: string[];
  expertise?: string[];
  country?: string | null;
  city?: string | null;
  timezone?: string | null;
  availableForRemote?: boolean;
  availability?: string | null;
  hoursPerWeek?: number | null;
  workPreferences?: ProviderWorkPreference[];
  portfolioUrl?: string | null;
  githubUrl?: string | null;
  linkedinUrl?: string | null;
}

export interface ProviderDirectoryResponse {
  items: PublicProviderProfile[];
  nextCursor: string | null;
}

export class ProviderApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ProviderApiError";
  }
}

async function request<T>(path: string, options: RequestInit = {}, expectedSupabaseId?: string): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (expectedSupabaseId && session?.user.id !== expectedSupabaseId) {
    throw new ProviderApiError("Your signed-in account changed. Reload this page before continuing.", 409);
  }
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = Array.isArray(body?.message) ? body.message.join(". ") : body?.message;
    throw new ProviderApiError(message || "Could not load provider information. Please try again.", response.status);
  }
  return body as T;
}

export async function getMyProviderProfile(signal?: AbortSignal, owner?: { id: string; supabaseId: string }): Promise<OwnerProviderProfile | null> {
  const profile = (await request<{ data: OwnerProviderProfile | null }>("/freelancers/me/profile", { signal }, owner?.supabaseId)).data;
  if (profile && owner && profile.userId !== owner.id) {
    throw new ProviderApiError("Your signed-in account changed. Reload this page before continuing.", 409);
  }
  return profile;
}

export async function updateMyProviderProfile(payload: UpdateProviderProfile, owner?: { id: string; supabaseId: string }): Promise<OwnerProviderProfile> {
  const profile = (await request<{ data: OwnerProviderProfile }>("/freelancers/me/profile", {
    method: "PATCH",
    body: JSON.stringify(payload),
  }, owner?.supabaseId)).data;
  if (owner && profile.userId !== owner.id) {
    throw new ProviderApiError("Your signed-in account changed. Reload this page before continuing.", 409);
  }
  return profile;
}

export async function getPublicProviderProfile(userId: string, signal?: AbortSignal): Promise<PublicProviderProfile> {
  return (await request<{ data: PublicProviderProfile }>(`/freelancers/${encodeURIComponent(userId)}`, { signal })).data;
}

export async function getProviderDirectory(
  filters: { q?: string; category?: ProviderCategory; cursor?: string },
  signal?: AbortSignal,
): Promise<ProviderDirectoryResponse> {
  const params = new URLSearchParams({ limit: "12" });
  if (filters.q) params.set("q", filters.q);
  if (filters.category) params.set("category", filters.category);
  if (filters.cursor) params.set("cursor", filters.cursor);
  return (await request<{ data: ProviderDirectoryResponse }>(`/freelancers?${params}`, { signal })).data;
}

export function providerName(profile: PublicProviderProfile): string {
  return profile.user?.displayName?.trim()
    || [profile.user?.firstName, profile.user?.lastName].filter(Boolean).join(" ").trim()
    || "Professional";
}

export function providerCategoryLabel(category: ProviderCategory | null): string {
  return PROVIDER_CATEGORIES.find((item) => item.value === category)?.label || "Professional";
}

/** Older stored links still need a safe protocol before being made clickable. */
export function safeProviderLink(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

export function providerPublicationNeeds(profile: Pick<PublicProviderProfile,
  "category" | "headline" | "summary" | "skills" | "portfolioUrl" | "githubUrl" | "linkedinUrl"
>): string[] {
  const needs: string[] = [];
  if (!profile.category) needs.push("a category");
  if ((profile.headline?.trim().length || 0) < 3) needs.push("a headline");
  if ((profile.summary?.trim().length || 0) < 30) needs.push("an introduction of at least 30 characters");
  if (!profile.skills?.some((skill) => skill.trim())) needs.push("at least one skill");
  if (![profile.portfolioUrl, profile.githubUrl].some(safeProviderLink)) needs.push("a portfolio or GitHub work link");
  return needs;
}
