import { useQuery } from '@tanstack/react-query';
import supabase from '@/lib/supabase';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

export type ServiceStatus = 'operational' | 'degraded' | 'down';

export interface SystemHealthData {
  generatedAt: string;
  services: { name: string; status: ServiceStatus; latency: string }[];
  database: { status: ServiceStatus; latencyMs: number | null; activeConnections: number | null; size: string | null };
  storage: { status: ServiceStatus; buckets: number; latencyMs: number | null };
  accounts: { total: number; new24h: number; active24h: number; verifiedRate: number; suspendedOrBanned: number; admins: number };
  jobs: {
    name: string;
    /** The job's registered name — what "Run now" takes. Absent on older servers. */
    key?: string;
    lastRun: string | null;
    nextRun: string | null;
    /** running | completed | failed | overdue | scheduled — across every server. */
    status: string;
    lastError?: string | null;
    lastDurationMs?: number | null;
    consecutiveFailures?: number;
  }[];
}

export type RunJobOutcome =
  | { ran: true; status: 'ok' | 'failed'; error: string | null; durationMs: number }
  | { ran: false; reason: 'disabled' | 'not-due' | 'running' | 'claim-failed' };

/** Runs one scheduled job now. Never alongside a copy that's already running. */
export async function runScheduledJob(key: string): Promise<RunJobOutcome> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  const res = await fetch(`${API_BASE_URL}/admin/scheduled-jobs/${encodeURIComponent(key)}/run`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d?.message || 'Could not run the job');
  return d.data as RunJobOutcome;
}

export function useSystemHealth(refetchInterval: number | false) {
  return useQuery({
    queryKey: ['admin', 'system-health'],
    queryFn: async (): Promise<SystemHealthData> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const res = await fetch(`${API_BASE_URL}/admin/system-health`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) throw new Error('Failed to fetch system health');
      const d = await res.json();
      if (!d.success) throw new Error('Invalid response');
      return d.data as SystemHealthData;
    },
    staleTime: 5 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchInterval,
  });
}
