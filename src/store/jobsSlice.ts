import { createSlice, PayloadAction, createSelector } from "@reduxjs/toolkit";
import { Job } from "@/data/jobs";

export interface FilterState {
  keywords: string;
  location: string;
  jobType: string[];
  experienceLevel: string[];
  datePosted: string;
  remote: boolean;
}

interface JobsState {
  jobs: Job[];
  selectedJobId: string | null;
  filters: FilterState;
  mobileScrollPosition: number;
  isFilterDrawerOpen: boolean;
  isLoading: boolean;
}

const initialState: JobsState = {
  jobs: [],
  selectedJobId: null,
  filters: {
    keywords: "",
    location: "",
    jobType: [],
    experienceLevel: [],
    datePosted: "",
    remote: false,
  },
  mobileScrollPosition: 0,
  isFilterDrawerOpen: false,
  isLoading: true,
};

export const selectFilteredJobs = createSelector(
  [
    (state: { jobs: JobsState }) => state.jobs.filters,
    (state: { jobs: JobsState }) => state.jobs.jobs,
  ],
  (filters, jobs): Job[] => {
    return jobs.filter((job) => {
      if (filters.keywords) {
        const searchTerms = filters.keywords.toLowerCase();
        const matchesKeywords =
          job.title.toLowerCase().includes(searchTerms) ||
          job.company.toLowerCase().includes(searchTerms) ||
          job.description.toLowerCase().includes(searchTerms) ||
          job.tags.some((tag) => tag.toLowerCase().includes(searchTerms));
        if (!matchesKeywords) return false;
      }

      if (filters.location) {
        const locationSearch = filters.location.toLowerCase();
        if (!job.location.toLowerCase().includes(locationSearch)) return false;
      }

      if (filters.jobType.length > 0) {
        if (!filters.jobType.includes(job.type)) return false;
      }

      if (filters.remote) {
        if (!job.location.toLowerCase().includes("remote")) return false;
      }

      return true;
    });
  }
);

export const selectCurrentJob = createSelector(
  [
    (state: { jobs: JobsState }) => state.jobs.selectedJobId,
    selectFilteredJobs,
  ],
  (selectedJobId, filteredJobs): Job | null => {
    if (!selectedJobId) return null;
    return filteredJobs.find((job) => job.id === selectedJobId) || null;
  }
);

const jobsSlice = createSlice({
  name: "jobs",
  initialState,
  reducers: {
    setJobs: (state, action: PayloadAction<Job[]>) => {
      state.jobs = action.payload;
    },
    setSelectedJobId: (state, action: PayloadAction<string | null>) => {
      state.selectedJobId = action.payload;
    },
    setFilters: (state, action: PayloadAction<Partial<FilterState>>) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    setKeywords: (state, action: PayloadAction<string>) => {
      state.filters.keywords = action.payload;
    },
    setLocation: (state, action: PayloadAction<string>) => {
      state.filters.location = action.payload;
    },
    toggleJobType: (state, action: PayloadAction<string>) => {
      const type = action.payload;
      if (state.filters.jobType.includes(type)) {
        state.filters.jobType = state.filters.jobType.filter((t) => t !== type);
      } else {
        state.filters.jobType.push(type);
      }
    },
    toggleExperienceLevel: (state, action: PayloadAction<string>) => {
      const level = action.payload;
      if (state.filters.experienceLevel.includes(level)) {
        state.filters.experienceLevel = state.filters.experienceLevel.filter(
          (l) => l !== level
        );
      } else {
        state.filters.experienceLevel.push(level);
      }
    },
    setDatePosted: (state, action: PayloadAction<string>) => {
      state.filters.datePosted = action.payload;
    },
    toggleRemote: (state) => {
      state.filters.remote = !state.filters.remote;
    },
    setMobileScrollPosition: (state, action: PayloadAction<number>) => {
      state.mobileScrollPosition = action.payload;
    },
    setFilterDrawerOpen: (state, action: PayloadAction<boolean>) => {
      state.isFilterDrawerOpen = action.payload;
    },
    resetFilters: (state) => {
      state.filters = initialState.filters;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
  },
});

export const {
  setJobs,
  setSelectedJobId,
  setFilters,
  setKeywords,
  setLocation,
  toggleJobType,
  toggleExperienceLevel,
  setDatePosted,
  toggleRemote,
  setMobileScrollPosition,
  setFilterDrawerOpen,
  resetFilters,
  setLoading,
} = jobsSlice.actions;

export default jobsSlice.reducer;
