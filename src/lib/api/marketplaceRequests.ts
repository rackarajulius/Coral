import supabase from "@/lib/supabase";
import type { MarketplaceKind, MarketplaceOwner, MarketplaceReportReason } from "@/lib/api/marketplace";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";
export type MarketplaceRequestStatus = "pending" | "accepted" | "declined" | "withdrawn" | "blocked";
export type MarketplaceRequestAction = "accept" | "decline" | "withdraw" | "block";
export type MarketplaceRequestSource = "direct" | "community" | "directory" | "profile";
export interface MarketplaceRequestCapabilities {
  enquiriesEnabled: boolean;
  canSubmit: boolean;
  reason?: string;
  existingRequestId?: string | null;
}
export interface MarketplaceRequestSummary {
  id: string;
  kind: MarketplaceKind;
  status: MarketplaceRequestStatus;
  createdAt: string;
  updatedAt: string;
  requester: { id: string; displayName: string };
  recipient: { id: string; displayName: string };
  requesterCompany?: { id: string; name: string } | null;
  recipientCompany?: { id: string; name: string } | null;
  listing: { kind: MarketplaceKind; id: string; title: string; url: string; available: boolean };
  viewerSide: "requester" | "recipient";
  unreadCount: number;
}
export interface MarketplaceRequestDetail extends MarketplaceRequestSummary {
  body: string;
  workSamples: { label: string; url: string }[];
  acceptedAt?: string | null;
  firstRecipientReplyAt?: string | null;
  permissions: { canAccept: boolean; canDecline: boolean; canWithdraw: boolean; canBlock: boolean; canSend: boolean; canReport: boolean };
}
export interface MarketplaceRequestMessage { id: string; requestId: string; senderId: string; body: string; createdAt: string }
export interface MarketplaceRequestPage<T> { data: T[]; meta: { page: number; limit: number; total: number; totalPages: number } }
export interface CreateMarketplaceRequest {
  kind: MarketplaceKind;
  listingId: string;
  body: string;
  workSamples?: { label: string; url: string }[];
  companyId?: string;
  idempotencyKey: string;
  source?: MarketplaceRequestSource;
  postId?: string;
}

export class MarketplaceRequestApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); this.name = "MarketplaceRequestApiError"; }
}
async function request<T>(path: string, options: RequestInit = {}, owner?: MarketplaceOwner): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (owner && session?.user.id !== owner.supabaseId) throw new MarketplaceRequestApiError("Your signed-in account changed. Reload before continuing.", 409);
  const response = await fetch(`${API_BASE_URL}/marketplace/requests${path}`, {
    ...options, cache: "no-store",
    headers: { "Content-Type": "application/json", ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}), ...options.headers },
  });
  const body = await response.json().catch(() => null);
  if (owner) {
    const { data: { session: current } } = await supabase.auth.getSession();
    if (current?.user.id !== owner.supabaseId) throw new MarketplaceRequestApiError("Your signed-in account changed. Reload before continuing.", 409);
  }
  if (!response.ok) {
    const message = Array.isArray(body?.message) ? body.message.join(". ") : body?.message;
    throw new MarketplaceRequestApiError(message || "We couldn't load this marketplace conversation. Please try again.", response.status);
  }
  return body as T;
}
export async function getMarketplaceRequestCapabilities(kind: MarketplaceKind, listingId: string, owner?: MarketplaceOwner, signal?: AbortSignal): Promise<MarketplaceRequestCapabilities> {
  return (await request<{ data: MarketplaceRequestCapabilities }>(`/capabilities?${new URLSearchParams({ kind, listingId })}`, { signal }, owner)).data;
}
export async function createMarketplaceRequest(payload: CreateMarketplaceRequest, owner: MarketplaceOwner): Promise<MarketplaceRequestDetail> {
  return (await request<{ data: MarketplaceRequestDetail }>("", { method: "POST", body: JSON.stringify(payload) }, owner)).data;
}
export function getMarketplaceRequests(box: "incoming" | "outgoing", page: number, owner: MarketplaceOwner, signal?: AbortSignal): Promise<MarketplaceRequestPage<MarketplaceRequestSummary>> {
  return request(`?${new URLSearchParams({ box, page: String(page), limit: "12" })}`, { signal }, owner);
}
export async function getMarketplaceRequest(id: string, owner: MarketplaceOwner, signal?: AbortSignal): Promise<MarketplaceRequestDetail> {
  return (await request<{ data: MarketplaceRequestDetail }>(`/${encodeURIComponent(id)}`, { signal }, owner)).data;
}
export async function setMarketplaceRequestState(id: string, action: MarketplaceRequestAction, owner: MarketplaceOwner): Promise<MarketplaceRequestDetail> {
  return (await request<{ data: MarketplaceRequestDetail }>(`/${encodeURIComponent(id)}/state`, { method: "POST", body: JSON.stringify({ action }) }, owner)).data;
}
export function getMarketplaceRequestMessages(id: string, page: number, owner: MarketplaceOwner, signal?: AbortSignal): Promise<MarketplaceRequestPage<MarketplaceRequestMessage>> {
  return request(`/${encodeURIComponent(id)}/messages?page=${page}&limit=50`, { signal }, owner);
}
export async function sendMarketplaceRequestMessage(id: string, payload: { body: string; idempotencyKey: string }, owner: MarketplaceOwner): Promise<MarketplaceRequestMessage> {
  return (await request<{ data: MarketplaceRequestMessage }>(`/${encodeURIComponent(id)}/messages`, { method: "POST", body: JSON.stringify(payload) }, owner)).data;
}
export async function markMarketplaceRequestRead(id: string, owner: MarketplaceOwner): Promise<void> {
  await request(`/${encodeURIComponent(id)}/read`, { method: "POST", body: "{}" }, owner);
}
export async function reportMarketplaceRequest(id: string, payload: { reason: MarketplaceReportReason; details?: string }, owner: MarketplaceOwner): Promise<void> {
  await request(`/${encodeURIComponent(id)}/report`, { method: "POST", body: JSON.stringify(payload) }, owner);
}
export const marketplaceRequestPath = (id: string, box: "incoming" | "outgoing" = "outgoing") => `/marketplace/inbox?${new URLSearchParams({ box, request: id })}`;
export const marketplaceRequestStatusLabel = (status: MarketplaceRequestStatus) => ({ pending: "Awaiting a reply", accepted: "Conversation open", declined: "Declined", withdrawn: "Withdrawn", blocked: "Blocked" })[status] || status;
export const marketplaceVisiblePolling = (): number | false => typeof document !== "undefined" && document.visibilityState === "visible" ? 20_000 : false;
export function safeMarketplaceWorkSample(value: string): string | null {
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password ? url.href : null; } catch { return null; }
}
