import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import supabase from '@/lib/supabase';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

export interface AuditRetention {
  days: number;
  min: number;
  max: number;
  default: number;
}

const QUERY_KEY = ['admin', 'settings', 'audit-retention'] as const;

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

export function useAuditRetention() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<AuditRetention> => {
      const res = await fetch(`${API_BASE_URL}/admin/settings/audit-retention`, {
        headers: await authHeaders(),
      });
      if (!res.ok) throw new Error('Failed to load retention setting');
      const d = await res.json();
      return d.data as AuditRetention;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateAuditRetention() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (days: number): Promise<number> => {
      const res = await fetch(`${API_BASE_URL}/admin/settings/audit-retention`, {
        method: 'PATCH',
        headers: await authHeaders(),
        body: JSON.stringify({ days }),
      });
      if (!res.ok) throw new Error('Failed to update retention setting');
      const d = await res.json();
      return (d.data?.days ?? days) as number;
    },
    onSuccess: (days) => {
      queryClient.setQueryData<AuditRetention>(QUERY_KEY, (prev) =>
        prev ? { ...prev, days } : prev,
      );
    },
  });
}
