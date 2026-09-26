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

export interface NextAction {
  id: string;
  /** lucide icon name — mapped to a component on the client. */
  icon: string;
  title: string;
  desc: string;
  cta: string;
  to: string;
  priority: number;
  highlight?: boolean;
}

/** Suggested actions computed from the employer's live state (empty = all caught up). */
export async function getNextActions(): Promise<NextAction[]> {
  const res = await fetch(`${API_BASE_URL}/employers/me/next-actions`, { headers: await authHeaders() });
  if (!res.ok) throw new Error("Failed to load next actions");
  return ((await res.json()).data ?? []) as NextAction[];
}
