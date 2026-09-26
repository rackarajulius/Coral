import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import supabase from '@/lib/supabase';
import { Application } from '@/data/admin/applications/applications';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

interface ListResponse {
  data: Application[];
  meta: {
    total: number;
    totalPages: number;
  };
}

interface ApplicationFilters {
  statuses?: string[];
  flaggedOnly?: boolean;
}

export function useApplicationsMetrics() {
  return useQuery({
    queryKey: ['admin', 'applications', 'metrics'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const res = await fetch(`${API_BASE_URL}/admin/applications/metrics`, {
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
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

export function useApplicationsList(params: {
  page: number;
  limit: number;
  search: string;
  filters: ApplicationFilters;
  sort?: string;
  sortDir?: 'asc' | 'desc';
}) {
  return useQuery({
    queryKey: ['admin', 'applications', 'list', params],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const urlParams = new URLSearchParams({
        page: String(params.page),
        limit: String(params.limit),
      });
      if (params.search.trim()) urlParams.set('search', params.search.trim());
      if (params.sort) urlParams.set('sort', params.sort);
      if (params.sortDir) urlParams.set('sortDir', params.sortDir);
      if (params.filters.statuses?.length) urlParams.set('statuses', params.filters.statuses.join(','));
      if (params.filters.flaggedOnly) urlParams.set('flaggedOnly', 'true');

      const res = await fetch(`${API_BASE_URL}/admin/applications/list?${urlParams}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) throw new Error('Failed to fetch applications');
      const d = await res.json();
      if (!d.success) throw new Error('Invalid response');
      return d as ListResponse;
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useApplicationActions() {
  const queryClient = useQueryClient();

  const invalidateApplications = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'applications'] });
  };

  return { invalidateApplications };
}
