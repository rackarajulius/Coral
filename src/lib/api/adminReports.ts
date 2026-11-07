import supabase from "@/lib/supabase";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

/** The moderation queues the Reports & Flags page shows, one tab each. */
export type ReportQueueKey = "community" | "listings" | "requests" | "reviews";

export interface ReportQueueSummary {
  key: ReportQueueKey;
  /** Items waiting for a decision, as that queue defines it. */
  open: number;
  /** When the longest-waiting item arrived; null when nothing is waiting. */
  oldestAt: string | null;
  detail?: { posts?: number; comments?: number; held?: number; reported?: number };
}

export interface ReportsSummary {
  total: number;
  queues: ReportQueueSummary[];
}

/**
 * Query key for the counts. Every queue's actions invalidate it, so a tab's
 * count drops as soon as an item there is decided.
 */
export const REPORTS_SUMMARY_KEY = ["admin", "reports", "summary"] as const;

export async function getReportsSummary(): Promise<ReportsSummary> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");
  const res = await fetch(`${API_BASE_URL}/admin/reports/summary`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.message || "Couldn't load the report counts");
  return body.data as ReportsSummary;
}
