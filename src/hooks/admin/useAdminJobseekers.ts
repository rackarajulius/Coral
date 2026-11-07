import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import supabase from '@/lib/supabase';
import { Jobseeker, JobseekerStatus } from '@/data/admin/jobseeker/jobs-data';
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

/** The jobseeker filters the server can answer (JobseekersListQueryDto). */
export interface JobseekerFilters {
  statuses: JobseekerStatus[];
  hasOpenReports: boolean;
  premiumOnly: boolean;
  signedUpFrom: string;
  signedUpTo: string;
  activeFrom: string;
  activeTo: string;
  country: string;
}

export const defaultJobseekerFilters: JobseekerFilters = {
  statuses: [],
  hasOpenReports: false,
  premiumOnly: false,
  signedUpFrom: '',
  signedUpTo: '',
  activeFrom: '',
  activeTo: '',
  country: '',
};

/** How many filter groups are set — for the badge on the Filters button. */
export const countJobseekerFilters = (f: JobseekerFilters) =>
  (f.statuses.length ? 1 : 0) +
  (f.hasOpenReports ? 1 : 0) +
  (f.premiumOnly ? 1 : 0) +
  (f.signedUpFrom || f.signedUpTo ? 1 : 0) +
  (f.activeFrom || f.activeTo ? 1 : 0) +
  (f.country.trim() ? 1 : 0);

export function useJobseekersList(params: {
  page: number;
  limit: number;
  search: string;
  sortField: string;
  sortDir: 'asc' | 'desc';
  filters: JobseekerFilters;
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
      const f = params.filters;
      if (f.statuses.length) urlParams.set('statuses', f.statuses.join(','));
      if (f.hasOpenReports) urlParams.set('hasOpenReports', 'true');
      if (f.premiumOnly) urlParams.set('premiumOnly', 'true');
      if (f.signedUpFrom) urlParams.set('signedUpFrom', f.signedUpFrom);
      if (f.signedUpTo) urlParams.set('signedUpTo', f.signedUpTo);
      if (f.activeFrom) urlParams.set('activeFrom', f.activeFrom);
      if (f.activeTo) urlParams.set('activeTo', f.activeTo);
      if (f.country.trim()) urlParams.set('country', f.country.trim());

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
