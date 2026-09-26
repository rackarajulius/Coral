import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import supabase from '@/lib/supabase';
import { AdminVerification, VerificationStatus, VerificationType } from '@/lib/api/verifications';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

interface ListResponse {
  data: AdminVerification[];
  meta: {
    total: number;
    totalPages: number;
  };
}

export function useVerificationsMetrics() {
  return useQuery({
    queryKey: ['admin', 'verifications', 'metrics'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const res = await fetch(`${API_BASE_URL}/admin/verifications/metrics`, {
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

export function useVerificationsList(params: {
  page: number;
  limit: number;
  status: VerificationStatus | 'ALL';
  type: VerificationType | 'ALL';
}) {
  return useQuery({
    queryKey: ['admin', 'verifications', 'list', params],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const urlParams = new URLSearchParams({
        page: String(params.page),
        limit: String(params.limit),
      });
      if (params.status !== 'ALL') urlParams.set('status', params.status);
      if (params.type !== 'ALL') urlParams.set('type', params.type);

      const res = await fetch(`${API_BASE_URL}/admin/verifications?${urlParams}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) throw new Error('Failed to fetch verifications');
      const d = await res.json();
      if (!d.success) throw new Error('Invalid response');
      return d as ListResponse;
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useVerificationActions() {
  const queryClient = useQueryClient();

  const invalidateVerifications = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'verifications'] });
  };

  return { invalidateVerifications };
}
