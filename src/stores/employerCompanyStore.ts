import { create } from "zustand";
import { EmployerCompany, getMyCompany } from "@/lib/api/employerCompany";

interface EmployerCompanyState {
  company: EmployerCompany | null;
  loading: boolean;
  loaded: boolean;
  fetchCompany: () => Promise<void>;
  setCompany: (company: EmployerCompany) => void;
}

export const useEmployerCompanyStore = create<EmployerCompanyState>((set) => ({
  company: null,
  loading: false,
  loaded: false,
  fetchCompany: async () => {
    set({ loading: true });
    try {
      const company = await getMyCompany();
      set({ company, loading: false, loaded: true });
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },
  setCompany: (company) => set({ company, loaded: true }),
}));
