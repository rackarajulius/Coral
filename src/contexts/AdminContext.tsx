import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import supabase from '@/lib/supabase';

interface DashboardMetrics {
  kpis: Array<{
    label: string;
    value: string;
    change: number;
    icon: string;
    trend: number[];
  }>;
  summary: {
    totalUsers: number;
    totalJobseekers: number;
    totalEmployers: number;
    totalFreelancers: number;
    activeListings: number;
    totalApplications: number;
    totalPosts: number;
    totalJobs: number;
    revenueMTD: number;
  };
  charts: {
    jobPostsOverTime: Array<{ month: string; posts: number }>;
    applicationsByCategory: Array<{ category: string; apps: number }>;
    employerApprovalRate: Array<{ week: string; rate: number }>;
    recentActivity: Array<{
      type: string;
      detail: string;
      timestamp: string;
      category: string;
    }>;
  };
}

interface AdminContextType {
  metrics: DashboardMetrics | null;
  isLoading: boolean;
  error: string | null;
  refreshMetrics: () => Promise<void>;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

// API Base URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

class AdminAPI {
  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    // Get the current Supabase session token
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (session?.access_token && !error) {
        config.headers = {
          ...config.headers,
          Authorization: `Bearer ${session.access_token}`,
        };
      }
    } catch (err) {
      console.error('Failed to get Supabase session for API request:', err);
    }

    const response = await fetch(url, config);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'An error occurred' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async getDashboardMetrics() {
    return this.request('/admin/dashboard/metrics');
  }
}

export function AdminProvider({ children }: { children: ReactNode }) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFetchedMetrics, setHasFetchedMetrics] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const { isAuthenticated, user, isLoading: authLoading } = useAuth();

  const api = new AdminAPI();

  const fetchMetrics = async (isInitialLoad = false) => {
    // Prevent multiple simultaneous fetches
    if (isFetching) return;

    try {
      setIsFetching(true);
      // Only show full-page loading for initial load, not for refreshes
      if (isInitialLoad) {
        setIsLoading(true);
      }
      setError(null);
      const response = await api.getDashboardMetrics();
      if (response.success) {
        setMetrics(response.data);
        setHasFetchedMetrics(true);
        if (isInitialLoad) {
          setIsLoading(false);
        }
      } else {
        throw new Error(response.message || 'Failed to fetch metrics');
      }
    } catch (err) {
      console.error('Failed to fetch dashboard metrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      if (isInitialLoad) {
        setIsLoading(false);
      }
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    // Only fetch metrics once when authentication is complete and user is authenticated
    // and we're on an admin route
    if (!authLoading && isAuthenticated && user && user.role === 'ADMIN' && !hasFetchedMetrics && window.location.pathname.startsWith('/admin')) {
      fetchMetrics(true); // isInitialLoad = true
    } else if (!authLoading) {
      // If authentication check is complete
      if (!isAuthenticated || !user || user.role !== 'ADMIN') {
        // User is not authenticated or not admin - AppLayout will handle the redirect
        setIsLoading(false);
        setMetrics(null);
        setError(null);
        setHasFetchedMetrics(false);
      }
      // If authenticated and admin but hasFetchedMetrics is true, do nothing (already fetched)
    }
  }, [authLoading, isAuthenticated, user?.role, hasFetchedMetrics]);

  const refreshMetrics = async () => {
    await fetchMetrics(false); // isInitialLoad = false (this is a refresh)
  };

  const value: AdminContextType = {
    metrics,
    isLoading,
    error,
    refreshMetrics,
  };

  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
}

export default AdminContext;