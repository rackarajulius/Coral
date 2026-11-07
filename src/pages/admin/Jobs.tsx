import { useState, useEffect } from "react";
import { Search, SlidersHorizontal, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { AdminSettableJobStatus, Job } from "@/data/admin/job/jobs";
import { defaultFilters, FilterPanel, Filters } from "@/components/adminDashboard/job/FilterPanel";
import { JobDetailDrawer } from "@/components/adminDashboard/job/JobDetailDrawer";
import { JobsTable } from "@/components/adminDashboard/job/JobsTable";
import { KpiRow } from "@/components/adminDashboard/job/KpiRow";
import supabase from "@/lib/supabase";
import { toast } from "sonner";
import { setJobStatus, deleteJob, STATUS_ACTION_COPY } from "@/lib/api/adminJobs";
import { useJobsMetrics, useJobsList, useJobActions } from "@/hooks/admin/useAdminJobs";

export default function Jobs() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  // What the drawer showed when opened — used only if the job drops out of
  // the current page (e.g. a status filter no longer matches it).
  const [selectedSnapshot, setSelectedSnapshot] = useState<Job | null>(null);
  const [busyJobId, setBusyJobId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortField, setSortField] = useState<"postedDate" | "applications" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { invalidateJobs } = useJobActions();
  const { data: metricsData, isLoading: isLoadingMetrics } = useJobsMetrics();
  const { data: listData, isLoading: isLoadingJobs } = useJobsList({
    page,
    limit,
    search: debouncedSearch,
    filters,
    sort: sortField || undefined,
    sortDir,
  });

  const jobs = listData?.data ?? [];
  const total = listData?.meta?.total ?? 0;
  const totalPages = listData?.meta?.totalPages ?? 1;
  const metrics = metricsData;
  // Read the open job from the latest list, so its badge and actions follow a
  // status change instead of showing what it was when the drawer opened.
  const selectedJob = jobs.find((j) => j.id === selectedJobId) ?? selectedSnapshot;

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const activeFilterCount =
    (filters.statuses.length > 0 ? 1 : 0) +
    (filters.types.length > 0 ? 1 : 0) +
    (filters.location && filters.location !== "__all" ? 1 : 0) +
    (filters.dateFrom || filters.dateTo ? 1 : 0) +
    (filters.salaryMin || filters.salaryMax ? 1 : 0) +
    (filters.minApplications ? 1 : 0) +
    (filters.company ? 1 : 0) +
    (filters.industry ? 1 : 0);

  const handleSelectJob = (job: Job) => {
    setSelectedJobId(job.id);
    setSelectedSnapshot(job);
    setDrawerOpen(true);
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleToggleAll = () => {
    if (selectedIds.length === jobs.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(jobs.map((j) => j.id));
    }
  };

  const handleSort = (field: "postedDate" | "applications") => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
    setPage(1);
  };

  const titleOf = (jobId: string) => jobs.find((j) => j.id === jobId)?.title ?? "The job";

  const handleUpdateStatus = async (jobId: string, status: AdminSettableJobStatus) => {
    setBusyJobId(jobId);
    try {
      await setJobStatus(jobId, status);
      toast.success(`${titleOf(jobId)} ${STATUS_ACTION_COPY[status].done}`);
      invalidateJobs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update the job");
    } finally {
      setBusyJobId(null);
    }
  };

  const handleDelete = async (jobId: string) => {
    setBusyJobId(jobId);
    try {
      const title = titleOf(jobId);
      await deleteJob(jobId);
      toast.success(`${title} was deleted`);
      if (selectedJobId === jobId) setDrawerOpen(false);
      setSelectedIds((prev) => prev.filter((id) => id !== jobId));
      invalidateJobs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete the job");
    } finally {
      setBusyJobId(null);
    }
  };

  /**
   * Runs one call per job and reports what actually happened. Promise.all
   * would stop at the first refusal and say nothing about the jobs that had
   * already changed.
   */
  const runBulk = async (jobIds: string[], run: (id: string) => Promise<void>, verb: string) => {
    const results = await Promise.allSettled(jobIds.map(run));
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    const done = jobIds.length - failed.length;
    const jobsWord = (n: number) => `${n} job${n !== 1 ? "s" : ""}`;
    if (done > 0) toast.success(`${jobsWord(done)} ${verb}`);
    if (failed.length > 0) {
      const reason = failed[0].reason instanceof Error ? failed[0].reason.message : "Unknown error";
      toast.error(`${jobsWord(failed.length)} couldn't be ${verb}`, { description: reason });
    }
    // Keep the ones that failed selected so they can be looked at.
    setSelectedIds(jobIds.filter((_, i) => results[i].status === "rejected"));
    invalidateJobs();
  };

  const handleBulkUpdateStatus = (jobIds: string[], status: AdminSettableJobStatus) =>
    runBulk(jobIds, (id) => setJobStatus(id, status), STATUS_ACTION_COPY[status].done.replace(/^is /, ""));

  const handleBulkDelete = (jobIds: string[]) => runBulk(jobIds, deleteJob, "deleted");

  return (
    <div  className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold text-foreground tracking-tight">Job Listings</h1>
          <p className="text-sm text-muted-foreground mt-1">Review, moderate, and manage all job postings</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search jobs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-64 h-9 bg-card border-gray-400"
            />
          </div>
          <Button variant="outline" size="sm" className="h-10 bg-card rounded-full" onClick={() => setFilterOpen(true)}>
            <SlidersHorizontal className="mr-1.5 h-4 w-4" />
            Filters
          </Button>
          <Button  variant="default" size="sm" className="h-10 gap-2 rounded-full" onClick={() => navigate("/admin/jobs/create")}>
            <Plus className="h-4 w-4" /> Create Job
          </Button>
        </div>
      </div>

      <Separator  />

      {/* KPIs */}
      <KpiRow metrics={metrics} />

      {/* Table */}
        <JobsTable
          jobs={jobs}
          onSelectJob={handleSelectJob}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onToggleAll={handleToggleAll}
          onUpdateStatus={handleUpdateStatus}
          onDelete={handleDelete}
          onBulkUpdateStatus={handleBulkUpdateStatus}
          onBulkDelete={handleBulkDelete}
          isLoading={isLoadingJobs}
          sortField={sortField}
          sortDir={sortDir}
          onSort={handleSort}
          page={page}
          limit={limit}
          total={total}
          totalPages={totalPages}
          onPageChange={setPage}
          onLimitChange={(l) => { setLimit(l); setPage(1); }}
        />

      {/* Drawers */}
      <JobDetailDrawer
        job={selectedJob}
        open={drawerOpen}
        onOpenChange={(v) => setDrawerOpen(v)}
        onUpdateStatus={handleUpdateStatus}
        onDelete={handleDelete}
        busy={busyJobId !== null && busyJobId === selectedJobId}
      />
      <FilterPanel open={filterOpen} onClose={() => setFilterOpen(false)} filters={filters} onChange={(f) => { setFilters(f); setPage(1); }} />
    </div>
  );
}
