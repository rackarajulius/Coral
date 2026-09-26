import supabase from "@/lib/supabase";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

export type AuditCategory = "TEAM" | "JOBS" | "CANDIDATES" | "INTEGRATIONS" | "COMPANY";

export interface AuditEntry {
  id: string;
  /** Kept even after the person leaves — the row still says who acted. */
  actorName: string;
  category: AuditCategory;
  action: string;
  entityType: string | null;
  entityId: string | null;
  /** Never a candidate's name. */
  entityName: string | null;
  summary: string;
  createdAt: string;
}

export interface AuditPage {
  entries: AuditEntry[];
  page: number;
  total: number;
  totalPages: number;
}

export const CATEGORY_LABELS: Record<AuditCategory, string> = {
  TEAM: "Team",
  JOBS: "Jobs",
  CANDIDATES: "Candidates",
  INTEGRATIONS: "Integrations",
  COMPANY: "Company",
};

export async function listAuditLog(query: {
  category?: AuditCategory;
  q?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
} = {}): Promise<AuditPage> {
  const params = new URLSearchParams();
  if (query.category) params.set("category", query.category);
  if (query.q?.trim()) params.set("q", query.q.trim());
  // Dates arrive as yyyy-mm-dd from the picker; the server widens `to` to the
  // end of that day so an inclusive range behaves as people expect.
  if (query.from) params.set("from", new Date(query.from).toISOString());
  if (query.to) params.set("to", new Date(query.to).toISOString());
  if (query.page) params.set("page", String(query.page));
  params.set("limit", String(query.limit ?? 50));

  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${API_BASE_URL}/employers/company/audit?${params.toString()}`, {
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message || "Couldn't load the activity log");
  }
  const json = await res.json();
  return {
    entries: (json.data ?? []) as AuditEntry[],
    page: json.meta?.page ?? 1,
    total: json.meta?.total ?? 0,
    totalPages: json.meta?.totalPages ?? 1,
  };
}
