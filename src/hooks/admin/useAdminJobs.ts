import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import supabase from '@/lib/supabase';
import { Job } from '@/data/admin/job/jobs';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

interface ListResponse {
  data: Job[];
  meta: {
    total: number;
    totalPages: number;
  };
}

export interface Filters {
  statuses: string[];
  types: string[];
  location?: string;
  dateFrom?: string;
  dateTo?: string;
  salaryMin?: string;
  salaryMax?: string;
  minApplications?: string;
  company?: string;
  industry?: string;
  flaggedOnly?: boolean;
  [key: string]: any;
}

export function useJobsMetrics() {
  return useQuery({
    queryKey: ['admin', 'jobs', 'metrics'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const res = await fetch(`${API_BASE_URL}/admin/jobs/metrics`, {
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

export function useJobsList(params: {
  page: number;
  limit: number;
  search: string;
  filters: Filters;
  sort?: string;
  sortDir?: 'asc' | 'desc';
}) {
  return useQuery({
    queryKey: ['admin', 'jobs', 'list', params],
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
      if (params.filters.types?.length) urlParams.set('types', params.filters.types.join(','));
      if (params.filters.location && params.filters.location !== '__all') urlParams.set('location', params.filters.location);
      if (params.filters.dateFrom) urlParams.set('dateFrom', params.filters.dateFrom);
      if (params.filters.dateTo) urlParams.set('dateTo', params.filters.dateTo);
      if (params.filters.salaryMin) urlParams.set('salaryMin', params.filters.salaryMin);
      if (params.filters.salaryMax) urlParams.set('salaryMax', params.filters.salaryMax);
      if (params.filters.minApplications) urlParams.set('minApplications', params.filters.minApplications);
      if (params.filters.company) urlParams.set('company', params.filters.company);
      if (params.filters.industry) urlParams.set('industry', params.filters.industry);
      if (params.filters.flaggedOnly) urlParams.set('flaggedOnly', 'true');

      const res = await fetch(`${API_BASE_URL}/admin/jobs/list?${urlParams}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) throw new Error('Failed to fetch jobs');
      const d = await res.json();
      if (!d.success) throw new Error('Invalid response');
      return d as ListResponse;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    placeholderData: keepPreviousData,
  });
}

export function useJobActions() {
  const queryClient = useQueryClient();

  const invalidateJobs = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'jobs'] });
  };

  return { invalidateJobs };
}
