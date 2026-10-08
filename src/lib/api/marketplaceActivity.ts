import supabase from '@/lib/supabase';
import type { MarketplaceKind, MarketplaceOwner } from './marketplace';
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';
export type MarketplaceSource = 'direct' | 'community' | 'directory' | 'profile';
async function request<T>(path: string, options: RequestInit = {}, owner?: MarketplaceOwner): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (owner && session?.user.id !== owner.supabaseId) throw new Error('Your signed-in account changed. Reload before continuing.');
  const response = await fetch(`${API_BASE_URL}/marketplace${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) } });
  const body = await response.json().catch(() => null);
  if (owner && (await supabase.auth.getSession()).data.session?.user.id !== owner.supabaseId) throw new Error('Your signed-in account changed. Reload before continuing.');
  if (!response.ok) throw new Error(body?.message || 'Marketplace information is unavailable.');
  return body.data as T;
}
export async function recordMarketplaceListingView(kind: MarketplaceKind, listingId: string, context: { source?: MarketplaceSource; postId?: string } = {}, signal?: AbortSignal): Promise<void> {
  // This browser-generated token is for view deduplication, not identity proof.
  let sessionId: string;
  try {
    const stored = sessionStorage.getItem('coral:marketplace:view-session:v1');
    sessionId = stored && /^[0-9a-f-]{36}$/i.test(stored) ? stored : crypto.randomUUID();
    if (sessionId !== stored) sessionStorage.setItem('coral:marketplace:view-session:v1', sessionId);
  } catch { return; }
  await request('/events/listing-view', { method: 'POST', signal, body: JSON.stringify({ kind, listingId, sessionId, source: context.source || 'direct', ...(context.postId ? { postId: context.postId } : {}) }) });
}
export interface MarketplaceRequestReport { id: string; reason: string; details: string | null; status: string; createdAt: string; reviewedAt: string | null }
export const getMarketplaceRequestReports = (owner: MarketplaceOwner, status = 'open', signal?: AbortSignal) => request<MarketplaceRequestReport[]>(`/moderation/request-reports?status=${status}`, { signal }, owner);
export const reviewMarketplaceRequestReport = (id: string, owner: MarketplaceOwner) => request(`/moderation/request-reports/${encodeURIComponent(id)}/review`, { method: 'POST', body: '{}' }, owner);
export interface MarketplaceMetrics { days: number; since: string; events: { type: string; source: string; count: number }[]; requests: { kind: string; status: string; count: number }[]; pendingDeliveries: number; definitions: Record<string, string> }
export const getMarketplaceMetrics = (owner: MarketplaceOwner, signal?: AbortSignal) => request<MarketplaceMetrics>('/metrics?days=30', { signal }, owner);
