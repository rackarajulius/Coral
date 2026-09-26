const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

// Types
export interface User {
  id: string;
  supabaseId: string;
  email: string;
  emailVerified: boolean;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  role: 'JOB_SEEKER' | 'EMPLOYER' | 'FREELANCER' | 'ADMIN';
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING_ONBOARDING';
  provider: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  data?: {
    user: User;
    isNewUser: boolean;
  };
}

export interface ProfileResponse {
  success: boolean;
  data: {
    user: User;
    jobSeekerProfile?: any;
    employerProfile?: any;
    freelancerProfile?: any;
  };
}

class ApiService {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    // Get token from localStorage on init
    this.token = localStorage.getItem('supabase.auth.token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('supabase.auth.token', token);
    } else {
      localStorage.removeItem('supabase.auth.token');
    }
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.getHeaders(),
          ...options.headers,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Request failed' }));
        throw new Error(error.message || `HTTP error! status: ${response.status}`);
      }

      return response.json();
    } catch (error: any) {
      if (error.message === 'Failed to fetch' || error.message.includes('NetworkError')) {
        throw new Error('Unable to connect to server. Please ensure the backend is running at http://localhost:3001');
      }
      throw error;
    }
  }

  // Auth endpoints
  async verifyToken(): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/verify');
  }

  async getCurrentUser(): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/me');
  }

  async updateRole(
    role: 'JOB_SEEKER' | 'EMPLOYER' | 'FREELANCER',
    userId?: string,
  ): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/role', {
      method: 'POST',
      body: JSON.stringify({ role, userId }),
    });
  }

  async completeOnboarding(data: {
    role: 'JOB_SEEKER' | 'EMPLOYER' | 'FREELANCER';
    profileData?: Record<string, unknown>;
  }): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/onboarding', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deactivateAccount(): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/deactivate', {
      method: 'POST',
    });
  }

  // User endpoints
  async getUserProfile(userId: string): Promise<ProfileResponse> {
    return this.request<ProfileResponse>(`/users/${userId}`);
  }

  async getMyProfile(): Promise<ProfileResponse> {
    return this.request<ProfileResponse>('/users/me/profile');
  }

  async updateProfile(data: {
    firstName?: string;
    lastName?: string;
    displayName?: string;
    avatarUrl?: string;
  }): Promise<{ success: boolean; data: { user: User } }> {
    return this.request(`/users/me`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return this.request('/auth/verify');
  }
}

export const api = new ApiService(API_BASE_URL);
