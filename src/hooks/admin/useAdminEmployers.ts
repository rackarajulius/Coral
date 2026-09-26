import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import supabase from '@/lib/supabase';
import { Employer } from '@/data/admin/employer/employers-data';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

interface ListResponse {
  data: Employer[];
  meta: {
    total: number;
    totalPages: number;
  };
}

interface Filters {
  status: string;
  industry: string;
}

export function useEmployersMetrics() {
  return useQuery({
    queryKey: ['admin', 'employers', 'metrics'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const res = await fetch(`${API_BASE_URL}/admin/employers/metrics`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) throw new Error('Failed to fetch metrics');
      const d = await res.json();
      if (!d.success) throw new Error('Invalid response');
      return d.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}

export function useEmployersList(params: {
  page: number;
  limit: number;
  search: string;
  sortKey: string;
  sortAsc: boolean;
  filters: Filters;
}) {
  return useQuery({
    queryKey: ['admin', 'employers', 'list', params],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const urlParams = new URLSearchParams({
        page: String(params.page),
        limit: String(params.limit),
        sort: params.sortKey,
        sortDir: params.sortAsc ? 'asc' : 'desc',
      });
      if (params.search.trim()) urlParams.set('search', params.search.trim());
      if (params.filters.status !== 'all') urlParams.set('status', params.filters.status);
      if (params.filters.industry !== 'all') urlParams.set('industry', params.filters.industry);

      const res = await fetch(`${API_BASE_URL}/admin/employers/list?${urlParams}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) throw new Error('Failed to fetch employers');
      const d = await res.json();
      if (!d.success) throw new Error('Invalid response');
      return d as ListResponse;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    placeholderData: keepPreviousData,
  });
}

export function useEmployerActions() {
  const queryClient = useQueryClient();

  const invalidateEmployers = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'employers'] });
  };

  return { invalidateEmployers };
}
