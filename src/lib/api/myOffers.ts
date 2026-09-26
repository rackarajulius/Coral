import supabase from "@/lib/supabase";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${API_BASE_URL}/offers${path}`, {
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

/**
 * An offer as the candidate sees it.
 *
 * Deliberately narrower than the employer's view: no internal notes, and
 * drafts never appear at all — an offer the employer is still composing is not
 * an offer yet.
 */
export interface MyOffer {
  id: string;
  status: "SENT" | "ACCEPTED" | "DECLINED" | "WITHDRAWN" | "EXPIRED";
  company: string;
  jobId: string;
  jobTitle: string;
  salaryAmount: number | null;
  salaryCurrency: string;
  salaryPeriod: string | null;
  startDate: string | null;
  expiresAt: string | null;
  message: string | null;
  sentAt: string | null;
  respondedAt: string | null;
}

export const getMyOffers = () => req<MyOffer[]>("/me");

export const acceptOffer = (offerId: string) =>
  req<{ id: string; status: string }>(`/${offerId}/accept`, { method: "POST" });

export const declineOffer = (offerId: string) =>
  req<{ id: string; status: string }>(`/${offerId}/decline`, { method: "POST" });
