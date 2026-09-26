import { create } from "zustand";
import { EmployerAnalytics, getMyAnalytics } from "@/lib/api/employerAnalytics";

interface EmployerAnalyticsState {
  analytics: EmployerAnalytics | null;
  loading: boolean;
  loaded: boolean;
  fetchAnalytics: () => Promise<void>;
}

export const useEmployerAnalyticsStore = create<EmployerAnalyticsState>((set) => ({
  analytics: null,
  loading: false,
  loaded: false,
  fetchAnalytics: async () => {
    set({ loading: true });
    try {
      const analytics = await getMyAnalytics();
      set({ analytics, loading: false, loaded: true });
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },
}));
