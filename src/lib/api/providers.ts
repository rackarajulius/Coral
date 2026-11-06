import supabase from "@/lib/supabase";
import { personName } from "@/lib/personName";
import type { PublicProject } from "@/lib/api/profileProjects";
import type { DoneWorkSummary } from "@/lib/api/marketplace";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

/** A kind of work: one of the server's list (useWorkCategories), never written down here. */
export type ProviderCategory = string;
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
  /** The Featured items from their profile; none when they've hidden it. */
  featured?: {
    id: string;
    type: "project" | "video" | "document" | "design";
    title: string;
    description: string | null;
    link: string | null;
    imageUrl: string | null;
  }[];
  /** The projects from their profile; none when they've hidden it. */
  projects?: PublicProject[];
  /** Whether a visitor can open their full profile (experience, education). */
  fullProfile?: boolean;
  /** Work done through Coral, confirmed by both sides. */
  doneWork?: DoneWorkSummary;
}

export interface OwnerProviderProfile extends PublicProviderProfile {
  id: string;
  providerEnabled: boolean;
  publicPreviewEnabled: boolean;
  updatedAt?: string;
  readiness?: { ready: boolean; missingFields: string[] };
  /** Where location searches find them, as read from the saved city and country; null when it couldn't be read. */
  place?: { city: string | null; region: string | null; country: string } | null;
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
  page: number;
  nextPage: number | null;
  /** Only when a location was asked for: how it was read, or null when it isn't a known place. */
  place?: { kind: "city" | "region" | "country"; label: string } | null;
}

/** The deepest directory page the API serves; a search narrows past it. */
export const MAX_PROVIDER_DIRECTORY_PAGE = 24;

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

/** How a provider replies to requests for their services, as Coral measured it. */
export interface ProviderResponsiveness {
  /** Whether there is enough to say anything at all. */
  available: boolean;
  /** Requests that count: answered, or a week old without an answer. */
  considered: number;
  replied: number;
  /** Median hours from request to first answer; null until enough answers are timed. */
  medianHoursToReply: number | null;
  /** How many requests must count before clients are shown anything. */
  needed: number;
}

/** A public provider's figures; null until there is enough to say. */
export async function getProviderResponsiveness(userId: string, signal?: AbortSignal): Promise<ProviderResponsiveness | null> {
  return (await request<{ data: ProviderResponsiveness | null }>(`/freelancers/${encodeURIComponent(userId)}/responsiveness`, { signal })).data;
}

/** The provider's own figures, including how far they are from being shown. */
export async function getMyProviderResponsiveness(signal?: AbortSignal): Promise<ProviderResponsiveness> {
  return (await request<{ data: ProviderResponsiveness }>("/freelancers/me/responsiveness", { signal })).data;
}

/** "within a day": the median, rounded up to words a client plans around. */
export function replyWithin(hours: number): string {
  if (hours <= 1) return "within an hour";
  if (hours <= 24) return "within a day";
  if (hours <= 72) return "within 3 days";
  if (hours <= 168) return "within a week";
  return "after more than a week";
}

export async function getProviderDirectory(
  filters: { q?: string; category?: ProviderCategory; location?: string; remote?: boolean; page?: number },
  signal?: AbortSignal,
): Promise<ProviderDirectoryResponse> {
  const params = new URLSearchParams({ limit: "12" });
  if (filters.q) params.set("q", filters.q);
  if (filters.category) params.set("category", filters.category);
  if (filters.location) params.set("location", filters.location);
  if (filters.remote) params.set("remote", "true");
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));
  return (await request<{ data: ProviderDirectoryResponse }>(`/freelancers?${params}`, { signal })).data;
}

/** The professionals you saved, newest first, in the directory's shape. */
export async function getSavedProfessionals(page: number, signal?: AbortSignal): Promise<ProviderDirectoryResponse> {
  return (await request<{ data: ProviderDirectoryResponse }>(`/freelancers/saved?page=${page}`, { signal })).data;
}

/** Everyone you saved, so a Save button can say so without a request of its own. */
export async function getSavedProfessionalIds(signal?: AbortSignal): Promise<string[]> {
  return (await request<{ data: string[] }>("/freelancers/saved/ids", { signal })).data;
}

export async function saveProfessional(userId: string): Promise<void> {
  await request(`/freelancers/${encodeURIComponent(userId)}/save`, { method: "POST" });
}

export async function unsaveProfessional(userId: string): Promise<void> {
  await request(`/freelancers/${encodeURIComponent(userId)}/save`, { method: "DELETE" });
}

/** Their name by the one rule (`personName`): first and last name, then display name. */
export function providerName(profile: PublicProviderProfile): string {
  return personName(profile.user) || "Professional";
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
