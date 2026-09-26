import { create } from "zustand";
import {
  BackendJobStatus,
  UpdateJobStatusOptions,
  deleteJobApi,
  duplicateJobApi,
  listMyJobs,
  mapBackendJobToUiJob,
  updateJobStatus as updateJobStatusApi,
} from "@/lib/api/employerJobs";

export type JobStatus = "Open" | "Closed" | "Draft" | "Paused" | "Archived";

export interface Job {
  id: string;
  title: string;
  status: JobStatus;
  applicants: number;
  activeCandidates: number;
  openInterviews: number;
  location: string;
  department: string;
  posted: string;
  closedAt?: string;
  closeReason?: string;
  type: string;
  recruiter?: string;
  ageDays: number;
}

interface JobsState {
  jobs: Job[];
  selected: string[];
  page: number;
  pageSize: number;
  search: string;
  statusFilter: "all" | Lowercase<JobStatus>;
  loading: boolean;
  loaded: boolean;
  fetchJobs: () => Promise<void>;
  toggleSelect: (id: string) => void;
  selectMany: (ids: string[], on: boolean) => void;
  clearSelection: () => void;
  setPage: (p: number) => void;
  setPageSize: (s: number) => void;
  setSearch: (s: string) => void;
  setStatusFilter: (s: JobsState["statusFilter"]) => void;
  duplicateJob: (id: string, suffix?: string) => Promise<Job | null>;
  closeJobs: (ids: string[], reason?: string) => Promise<void>;
  pauseJobs: (ids: string[]) => Promise<void>;
  reopenJob: (id: string) => Promise<void>;
  updateJob: (id: string, patch: Partial<Job>) => void;
  publishJobs: (ids: string[]) => Promise<void>;
  archiveJobs: (ids: string[]) => Promise<void>;
  deleteJobs: (ids: string[]) => Promise<void>;
  assignRecruiter: (ids: string[], recruiter: string) => void;
}

function statusUpdateError(ids: string[], results: PromiseSettledResult<unknown>[], verb: string): Error | null {
  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length === 0) return null;

  if (ids.length === 1) {
    const reason = (failed[0] as PromiseRejectedResult).reason;
    return new Error(reason?.message || `Failed to ${verb} job`);
  }

  return new Error(`${ids.length - failed.length} of ${ids.length} jobs ${verb}d; ${failed.length} failed.`);
}

export const useJobsStore = create<JobsState>((set, get) => {
  const applyStatusToMany = async (
    ids: string[],
    status: BackendJobStatus,
    opts?: UpdateJobStatusOptions,
    localPatch?: Partial<Job>,
  ) => {
    const results = await Promise.allSettled(ids.map((id) => updateJobStatusApi(id, status, opts)));

    set((s) => ({
      jobs: s.jobs.map((j) => {
        const index = ids.indexOf(j.id);
        if (index === -1) return j;
        const result = results[index];
        if (result.status !== "fulfilled") return j;
        return { ...mapBackendJobToUiJob(result.value, j), ...localPatch };
      }),
    }));

    const error = statusUpdateError(ids, results, "update");
    if (error) throw error;
  };

  return {
    jobs: [],
    selected: [],
    page: 1,
    pageSize: 10,
    search: "",
    statusFilter: "all",
    loading: false,
    loaded: false,
    fetchJobs: async () => {
      set({ loading: true });
      try {
        const data = await listMyJobs();
        set((s) => ({
          jobs: data.map((job) => mapBackendJobToUiJob(job, s.jobs.find((j) => j.id === job.id))),
          loading: false,
          loaded: true,
        }));
      } catch (err) {
        set({ loading: false });
        throw err;
      }
    },
    toggleSelect: (id) =>
      set((s) => ({
        selected: s.selected.includes(id) ? s.selected.filter((x) => x !== id) : [...s.selected, id],
      })),
    selectMany: (ids, on) =>
      set((s) => ({
        selected: on
          ? Array.from(new Set([...s.selected, ...ids]))
          : s.selected.filter((x) => !ids.includes(x)),
      })),
    clearSelection: () => set({ selected: [] }),
    setPage: (page) => set({ page }),
    setPageSize: (pageSize) => set({ pageSize, page: 1 }),
    setSearch: (search) => set({ search, page: 1 }),
    setStatusFilter: (statusFilter) => set({ statusFilter, page: 1 }),
    duplicateJob: async (id, suffix = "(Copy)") => {
      const src = get().jobs.find((j) => j.id === id);
      if (!src) return null;
      const duplicated = await duplicateJobApi(id, `${src.title} ${suffix}`);
      const newJob = mapBackendJobToUiJob(duplicated);
      set((s) => ({ jobs: [newJob, ...s.jobs] }));
      return newJob;
    },
    closeJobs: async (ids, reason) => {
      await applyStatusToMany(ids, "closed", { reason }, { closeReason: reason });
      set({ selected: [] });
    },
    pauseJobs: async (ids) => {
      await applyStatusToMany(ids, "paused");
      set((s) => ({ selected: s.selected.filter((id) => !ids.includes(id)) }));
    },
    reopenJob: async (id) => {
      await applyStatusToMany([id], "active");
    },
    updateJob: (id, patch) =>
      set((s) => ({
        jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...patch } : j)),
      })),
    publishJobs: async (ids) => {
      await applyStatusToMany(ids, "active");
      set({ selected: [] });
    },
    archiveJobs: async (ids) => {
      await applyStatusToMany(ids, "archived");
      set({ selected: [] });
    },
    deleteJobs: async (ids) => {
      const results = await Promise.allSettled(ids.map((id) => deleteJobApi(id)));
      const succeededIds = new Set(ids.filter((_, i) => results[i].status === "fulfilled"));

      set((s) => ({
        jobs: s.jobs.filter((j) => !succeededIds.has(j.id)),
        selected: [],
      }));

      const error = statusUpdateError(ids, results, "delete");
      if (error) throw error;
    },
    // Local-only annotation: the Job model has no "recruiter" field, so this
    // never persists server-side and resets after the next fetchJobs().
    assignRecruiter: (ids, recruiter) =>
      set((s) => ({
        jobs: s.jobs.map((j) => (ids.includes(j.id) ? { ...j, recruiter } : j)),
        selected: [],
      })),
  };
});
