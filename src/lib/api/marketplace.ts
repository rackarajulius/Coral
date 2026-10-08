import supabase from "@/lib/supabase";
import { PROVIDER_CATEGORIES, type ProviderCategory } from "@/lib/api/providers";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";
export const MARKETPLACE_CATEGORIES = PROVIDER_CATEGORIES;
export const MARKETPLACE_CURRENCIES: Record<string, number> = { CAD: 2, USD: 2, EUR: 2, GBP: 2, JPY: 0, KWD: 3 };
export type MarketplaceKind = "service" | "project";
export type WorkMode = "remote" | "hybrid" | "onsite";
export type MarketplaceStatus = "draft" | "published" | "open" | "paused" | "closed" | "archived";
export type MarketplaceOwner = { id: string; supabaseId: string };
export interface MarketplaceCapabilities {
  listingWritesEnabled: boolean;
  categories: ProviderCategory[];
  currencies: Record<string, number>;
  canCreateService: boolean;
  canCreateProject: boolean;
  companies: { id: string; name: string }[];
}
export interface MarketplacePermissions {
  canEdit: boolean;
  canPublish: boolean;
  canPause: boolean;
  canClose: boolean;
  canArchive: boolean;
}
interface MarketplaceRecordBase {
  id: string;
  title: string;
  description: string;
  category: ProviderCategory;
  skills: string[];
  workMode: WorkMode;
  country: string;
  city: string | null;
  status: MarketplaceStatus;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  owner: { id: string; displayName: string; avatarUrl: string | null; profileUrl: string | null };
  company: { id: string; name: string } | null;
  // These fields only appear in the authenticated management projection.
  ownerUserId?: string;
  publicConsent?: boolean;
  permissions?: MarketplacePermissions;
}
export interface ServiceListing extends MarketplaceRecordBase {
  deliverables: string[];
  workSamples: { label: string; url: string }[];
  availability: "available" | "limited" | "unavailable";
  pricingMode: "fixed" | "hourly" | "quote";
  currency: string;
  amountMinor: number | null;
}
export interface ProjectBrief extends MarketplaceRecordBase {
  scope: string;
  budgetMode: "fixed" | "range" | "negotiable";
  currency: string;
  minBudgetMinor: number | null;
  maxBudgetMinor: number | null;
  deadline: string | null;
}
export type MarketplaceRecord = ServiceListing | ProjectBrief;
export interface MarketplacePage {
  data: MarketplaceRecord[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
export interface MarketplaceDraftPayload {
  title: string;
  description: string;
  category: ProviderCategory;
  skills: string[];
  workMode: WorkMode;
  country: string;
  city: string | null;
  companyId?: string;
  publicConsent: boolean;
  deliverables?: string[];
  workSamples?: { label: string; url: string }[];
  availability?: ServiceListing["availability"];
  pricingMode?: ServiceListing["pricingMode"];
  amountMinor?: number | null;
  currency: string;
  scope?: string;
  budgetMode?: ProjectBrief["budgetMode"];
  minBudgetMinor?: number | null;
  maxBudgetMinor?: number | null;
  deadline?: string | null;
}

export class MarketplaceApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "MarketplaceApiError";
  }
}

async function request<T>(path: string, options: RequestInit = {}, owner?: MarketplaceOwner): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (owner && session?.user.id !== owner.supabaseId) {
    throw new MarketplaceApiError("Your signed-in account changed. Reload before continuing.", 409);
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
  // A response from a previous session must not populate this account's form.
  if (owner) {
    const { data: { session: current } } = await supabase.auth.getSession();
    if (current?.user.id !== owner.supabaseId) throw new MarketplaceApiError("Your signed-in account changed. Reload before continuing.", 409);
  }
  if (!response.ok) {
    const message = Array.isArray(body?.message) ? body.message.join(". ") : body?.message;
    throw new MarketplaceApiError(message || "We couldn't load marketplace information. Please try again.", response.status);
  }
  return body as T;
}

export async function getMarketplaceCapabilities(owner?: MarketplaceOwner, signal?: AbortSignal): Promise<MarketplaceCapabilities> {
  return (await request<{ data: MarketplaceCapabilities }>("/marketplace/capabilities", { signal }, owner)).data;
}
const endpoint = (kind: MarketplaceKind) => kind === "service" ? "/services" : "/gigs";
export async function getMarketplaceDirectory(kind: MarketplaceKind, filters: {
  q?: string; category?: ProviderCategory; skill?: string; workMode?: WorkMode; country?: string; city?: string; availability?: ServiceListing['availability']; page?: number;
}, signal?: AbortSignal): Promise<MarketplacePage> {
  const params = new URLSearchParams({ page: String(filters.page || 1), limit: "12" });
  for (const field of ["q", "category", "skill", "workMode", "country", "city", "availability"] as const) if (filters[field]) params.set(field, filters[field]);
  return request<MarketplacePage>(`${endpoint(kind)}?${params}`, { signal });
}
export async function getMarketplaceRecord(kind: MarketplaceKind, id: string, signal?: AbortSignal): Promise<MarketplaceRecord> {
  return (await request<{ data: MarketplaceRecord }>(`${endpoint(kind)}/${encodeURIComponent(id)}`, { signal })).data;
}
export async function getMyMarketplaceRecords(kind: MarketplaceKind, page: number, owner: MarketplaceOwner, signal?: AbortSignal): Promise<MarketplacePage> {
  return request<MarketplacePage>(`${endpoint(kind)}/mine?page=${page}&limit=12`, { signal }, owner);
}
export async function getMyMarketplaceRecord(kind: MarketplaceKind, id: string, owner: MarketplaceOwner, signal?: AbortSignal): Promise<MarketplaceRecord> {
  return (await request<{ data: MarketplaceRecord }>(`${endpoint(kind)}/mine/${encodeURIComponent(id)}`, { signal }, owner)).data;
}
export async function saveMarketplaceRecord(kind: MarketplaceKind, payload: MarketplaceDraftPayload, owner: MarketplaceOwner, id?: string): Promise<MarketplaceRecord> {
  return (await request<{ data: MarketplaceRecord }>(`${endpoint(kind)}${id ? `/${encodeURIComponent(id)}` : ""}`, {
    method: id ? "PATCH" : "POST", body: JSON.stringify(payload),
  }, owner)).data;
}
export async function setMarketplaceRecordState(kind: MarketplaceKind, id: string, status: MarketplaceStatus, owner: MarketplaceOwner): Promise<MarketplaceRecord> {
  return (await request<{ data: MarketplaceRecord }>(`${endpoint(kind)}/${encodeURIComponent(id)}/state`, {
    method: "POST", body: JSON.stringify({ status }),
  }, owner)).data;
}
export type MarketplaceReportReason = "spam" | "fraud" | "harassment" | "inappropriate" | "other";
export async function reportMarketplaceRecord(kind: MarketplaceKind, id: string, payload: { reason: MarketplaceReportReason; details?: string }, owner: MarketplaceOwner): Promise<void> {
  await request(`${endpoint(kind)}/${encodeURIComponent(id)}/report`, { method: "POST", body: JSON.stringify(payload) }, owner);
}

export const marketplacePath = (kind: MarketplaceKind, id?: string) => `/${kind === "service" ? "services" : "projects"}${id ? `/${encodeURIComponent(id)}` : ""}`;
export function marketplaceMoney(amountMinor: number | null | undefined, currency = "CAD"): string {
  if (amountMinor == null) return "Not specified";
  const digits = MARKETPLACE_CURRENCIES[currency] ?? 2;
  return new Intl.NumberFormat("en-CA", { style: "currency", currency, currencyDisplay: "code", minimumFractionDigits: digits }).format(amountMinor / 10 ** digits);
}
export function marketplacePrice(record: MarketplaceRecord, kind: MarketplaceKind): string {
  if (kind === "service") {
    const service = record as ServiceListing;
    return service.pricingMode === "quote" ? "Price by quote" : `${marketplaceMoney(service.amountMinor, service.currency)}${service.pricingMode === "hourly" ? " / hour" : " fixed price"}`;
  }
  const project = record as ProjectBrief;
  return project.budgetMode === "negotiable" ? "Budget negotiable" : project.budgetMode === "range"
    ? `${marketplaceMoney(project.minBudgetMinor, project.currency)} – ${marketplaceMoney(project.maxBudgetMinor, project.currency)}`
    : marketplaceMoney(project.minBudgetMinor, project.currency);
}
export const marketplaceWorkMode = (mode: WorkMode) => ({ remote: "Remote", hybrid: "Hybrid", onsite: "On site" })[mode] || "Work location not specified";
export const marketplaceStatusLabel = (status: MarketplaceStatus) => ({ draft: "Private draft", published: "Published", open: "Open", paused: "Paused", closed: "Closed", archived: "Archived" })[status] || status;

export interface MarketplaceModerationReport {
  id: string;
  reason: string;
  details: string | null;
  createdAt: string;
  kind: MarketplaceKind;
  target: { id: string; title: string; description: string; scope: string | null; deliverables: string[]; status: MarketplaceStatus; removed: boolean } | null;
}
export async function getMarketplaceModerationReports(status: "open" | "reviewed", owner: MarketplaceOwner, signal?: AbortSignal): Promise<MarketplaceModerationReport[]> {
  return (await request<{ data: MarketplaceModerationReport[] }>(`/marketplace/moderation/reports?status=${status}`, { signal }, owner)).data;
}
export async function moderateMarketplaceRecord(kind: MarketplaceKind, id: string, action: "remove" | "restore", owner: MarketplaceOwner, reason?: string): Promise<void> {
  await request(`/marketplace/moderation/${kind}/${encodeURIComponent(id)}/${action}`, { method: "POST", body: JSON.stringify(action === "remove" ? { reason } : {}) }, owner);
}
export async function reviewMarketplaceReport(id: string, owner: MarketplaceOwner): Promise<void> {
  await request(`/marketplace/moderation/reports/${encodeURIComponent(id)}/review`, { method: "POST", body: "{}" }, owner);
}
