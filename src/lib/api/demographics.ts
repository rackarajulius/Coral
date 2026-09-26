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

/**
 * A person's own voluntary self-report. There is no API for reading anyone
 * else's — the admin side only ever gets group aggregates.
 */
export interface DemographicReport {
  ethnicity?: string | null;
  gender?: string | null;
  ageBand?: string | null;
  disability?: string | null;
  veteran?: string | null;
  updatedAt?: string;
}

export async function getMyDemographics(): Promise<DemographicReport | null> {
  const res = await fetch(`${API_BASE_URL}/me/demographics`, { headers: await authHeaders() });
  if (!res.ok) return null;
  return ((await res.json())?.data ?? null) as DemographicReport | null;
}

export async function saveMyDemographics(input: DemographicReport): Promise<DemographicReport> {
  const res = await fetch(`${API_BASE_URL}/me/demographics`, {
    method: "PUT",
    headers: await authHeaders(),
    // Strip nulls/blanks — the API validates against a fixed option list.
    body: JSON.stringify(
      Object.fromEntries(
        Object.entries(input).filter(([k, v]) => k !== "updatedAt" && !!v),
      ),
    ),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || "Couldn't save");
  }
  return (await res.json()).data as DemographicReport;
}

export async function deleteMyDemographics(): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/me/demographics`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error("Couldn't remove");
}
