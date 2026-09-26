import supabase from "@/lib/supabase";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${API_BASE_URL}/calls${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message || "Call failed");
  }
  return (await res.json()).data as T;
}

export type CallMode = "AUDIO" | "VIDEO";

/**
 * FAILED is not MISSED: missed means nobody answered, failed means both sides
 * were present but the peer connection never established.
 */
export type CallState = "RINGING" | "ACCEPTED" | "DECLINED" | "MISSED" | "ENDED" | "FAILED";

export interface Call {
  id: string;
  conversationId: string;
  callerId: string;
  calleeId: string;
  mode: CallMode;
  state: CallState;
  startedAt: string;
  answeredAt: string | null;
  endedAt: string | null;
  durationSec: number | null;
  /** Realtime channel both sides join to negotiate the peer connection. */
  channelName: string;
  ringTimeoutMs: number;
}

export const startCall = (conversationId: string, mode: CallMode) =>
  req<Call>("", { method: "POST", body: JSON.stringify({ conversationId, mode }) });

export const getCall = (id: string) => req<Call>(`/${id}`);
export const acceptCall = (id: string) => req<Call>(`/${id}/accept`, { method: "POST" });
export const declineCall = (id: string) => req<Call>(`/${id}/decline`, { method: "POST" });

/** `failed` marks a call that rang and was answered but never connected. */
export const endCall = (id: string, failed = false) =>
  req<Call>(`/${id}/end`, { method: "POST", body: JSON.stringify({ failed }) });

export const getCallHistory = (conversationId: string) =>
  req<Call[]>(`/conversations/${conversationId}/history`);
