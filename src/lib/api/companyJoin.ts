import supabase from "@/lib/supabase";
import type { CompanyRole } from "@/lib/api/companyTeam";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${API_BASE_URL}/company-join/${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message || "Request failed");
  }
  return (await res.json()).data as T;
}

/** Deliberately thin: the holder has proven nothing yet. */
export interface JoinPreview {
  companyName: string;
  role: CompanyRole;
  domainLocked: boolean;
  domain: string | null;
}

export interface JoinOutcome {
  companyId: string;
  companyName: string;
  role: CompanyRole;
  /** PENDING when the address is off-domain and an owner must approve. */
  status: "ACTIVE" | "PENDING" | "SUSPENDED" | "REMOVED";
  pendingReason: string | null;
}

export const previewJoinLink = (token: string) =>
  req<JoinPreview>(`preview?token=${encodeURIComponent(token)}`);

export const acceptJoinLink = (token: string) =>
  req<JoinOutcome>("accept", { method: "POST", body: JSON.stringify({ token }) });

/** An invitation addressed to one person, rather than a shared link. */
export interface InvitationPreview {
  companyName: string;
  role: CompanyRole;
  /** The address it was sent to — shown so a wrong-account sign-in is obvious. */
  email: string;
}

export const previewInvitation = (token: string) =>
  req<InvitationPreview>(`invitation/preview?token=${encodeURIComponent(token)}`);

export const acceptInvitation = (token: string) =>
  req<JoinOutcome>("invitation/accept", { method: "POST", body: JSON.stringify({ token }) });
