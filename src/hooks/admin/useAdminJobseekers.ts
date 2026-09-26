import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import supabase from '@/lib/supabase';
import { Jobseeker } from '@/data/admin/jobseeker/jobs-data';
import { JobseekerMetrics } from '@/components/adminDashboard/jobseeker/JobseekerKPICards';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

interface ListResponse {
  data: Jobseeker[];
  meta: {
    total: number;
    totalPages: number;
  };
}

export function useJobseekersMetrics() {
  return useQuery({
    queryKey: ['admin', 'jobseekers', 'metrics'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const res = await fetch(`${API_BASE_URL}/admin/jobseekers/metrics`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) throw new Error('Failed to fetch metrics');
      const d = await res.json();
      if (!d.success) throw new Error('Invalid response');
      return d.data as JobseekerMetrics;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}

export function useJobseekersList(params: {
  page: number;
  limit: number;
  search: string;
  sortField: string;
  sortDir: 'asc' | 'desc';
}) {
  return useQuery({
    queryKey: ['admin', 'jobseekers', 'list', params],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const urlParams = new URLSearchParams({
        page: String(params.page),
        limit: String(params.limit),
        sort: params.sortField,
        sortDir: params.sortDir,
      });
      if (params.search.trim()) urlParams.set('search', params.search.trim());

      const res = await fetch(`${API_BASE_URL}/admin/jobseekers/list?${urlParams}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) throw new Error('Failed to fetch jobseekers');
      const d = await res.json();
      if (!d.success) throw new Error('Invalid response');
      return d as ListResponse;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    placeholderData: keepPreviousData,
  });
}

export function useJobseekerActions() {
  const queryClient = useQueryClient();

  const invalidateJobseekers = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'jobseekers'] });
  };

  return { invalidateJobseekers };
}
