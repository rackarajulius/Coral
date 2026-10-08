import supabase from "@/lib/supabase";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

export type ExternalStatus = "saved" | "applied" | "under_review" | "interview" | "offer" | "rejected" | "withdrawn";

export interface ExternalApplication {
  id: string;
  sourceKey: string;
  title: string;
  company: string;
  url: string | null;
  status: ExternalStatus;
  appliedAt: string | null;
  followUpAt: string | null;
  remindedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExternalInput {
  sourceKey?: string;
  title: string;
  company: string;
  url?: string;
  status?: ExternalStatus;
  appliedAt?: string;
}

export interface UpdateExternalInput {
  status?: ExternalStatus;
  appliedAt?: string | null;
  followUpAt?: string | null;
  notes?: string | null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Sign in to track external applications");
  const res = await fetch(`${API_BASE_URL}/applications/external${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message || "Couldn't update external applications");
  }
  return (await res.json()).data as T;
}

export const getExternalApplications = () => request<ExternalApplication[]>("");
export const createExternalApplication = (input: CreateExternalInput) =>
  request<ExternalApplication>("", { method: "POST", body: JSON.stringify(input) });
export const updateExternalApplication = (id: string, input: UpdateExternalInput) =>
  request<ExternalApplication>(`/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) });
export const deleteExternalApplication = (id: string) =>
  request<{ deleted: boolean }>(`/${encodeURIComponent(id)}`, { method: "DELETE" });
