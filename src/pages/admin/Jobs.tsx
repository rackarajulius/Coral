import { useState, useEffect } from "react";
import { Search, SlidersHorizontal, Download, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Job } from "@/data/admin/job/jobs";
import { defaultFilters, FilterPanel, Filters } from "@/components/adminDashboard/job/FilterPanel";
import { JobDetailDrawer } from "@/components/adminDashboard/job/JobDetailDrawer";
import { JobsTable } from "@/components/adminDashboard/job/JobsTable";
import { KpiRow } from "@/components/adminDashboard/job/KpiRow";
import supabase from "@/lib/supabase";
import { toast } from "sonner";
import { setJobStatus, deleteJob } from "@/lib/api/adminJobs";
import { useJobsMetrics, useJobsList, useJobActions } from "@/hooks/admin/useAdminJobs";

export default function Jobs() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
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
    (filters.industry ? 1 : 0) +
    (filters.flaggedOnly ? 1 : 0);

  const handleSelectJob = (job: Job) => {
    setSelectedJob(job);
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

  const handleUpdateStatus = async (jobId: string, status: Job["status"]) => {
    try {
      await setJobStatus(jobId, status);
      toast.success(`Job marked ${status}`);
      invalidateJobs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update job");
    }
  };

  const handleDelete = async (jobId: string) => {
    try {
      await deleteJob(jobId);
      toast.success("Job deleted");
      invalidateJobs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete job");
    }
  };

  const handleBulkUpdateStatus = async (jobIds: string[], status: Job["status"]) => {
    try {
      await Promise.all(jobIds.map((id) => setJobStatus(id, status)));
      toast.success(`${jobIds.length} job${jobIds.length !== 1 ? "s" : ""} marked ${status}`);
      setSelectedIds([]);
      invalidateJobs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update jobs");
    }
  };

  const handleBulkDelete = async (jobIds: string[]) => {
    try {
      await Promise.all(jobIds.map((id) => deleteJob(id)));
      toast.success(`${jobIds.length} job${jobIds.length !== 1 ? "s" : ""} deleted`);
      setSelectedIds([]);
      invalidateJobs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete jobs");
    }
  };

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
          <Button variant="outline" size="sm" className="h-10 gap-2 hidden sm:flex rounded-full">
            <Download className="h-4 w-4" /> Export
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
      <JobDetailDrawer job={selectedJob} open={drawerOpen} onOpenChange={(v) => setDrawerOpen(v)} />
      <FilterPanel open={filterOpen} onClose={() => setFilterOpen(false)} filters={filters} onChange={(f) => { setFilters(f); setPage(1); }} />
    </div>
  );
}
