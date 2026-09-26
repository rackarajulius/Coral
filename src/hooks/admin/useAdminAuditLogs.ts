import { useQuery, keepPreviousData } from '@tanstack/react-query';
import supabase from '@/lib/supabase';
import type { AuditLogEntry } from '@/data/admin/audit-logs/types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

interface ListResponse {
  data: AuditLogEntry[];
  meta: { total: number; totalPages: number };
}

export function useAuditLogs(params: {
  page: number;
  limit: number;
  search: string;
  action: string;
  entityType: string;
  status: string;
}) {
  return useQuery({
    queryKey: ['admin', 'audit-logs', 'list', params],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const urlParams = new URLSearchParams({
        page: String(params.page),
        limit: String(params.limit),
      });
      if (params.search.trim()) urlParams.set('search', params.search.trim());
      if (params.action !== 'all') urlParams.set('action', params.action);
      if (params.entityType !== 'all') urlParams.set('entityType', params.entityType);
      if (params.status !== 'all') urlParams.set('status', params.status);

      const res = await fetch(`${API_BASE_URL}/admin/audit-logs?${urlParams}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) throw new Error('Failed to fetch audit logs');
      const d = await res.json();
      if (!d.success) throw new Error('Invalid response');
      return d as ListResponse;
    },
    staleTime: 60 * 1000,
    gcTime: 15 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}
