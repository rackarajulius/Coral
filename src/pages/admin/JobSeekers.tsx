import { useState, useEffect } from "react";
import { Search, SlidersHorizontal, Download, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Jobseeker } from "@/data/admin/jobseeker/jobs-data";
import { useNavigate } from "react-router";
import { JobseekerKPICards, type JobseekerMetrics } from "@/components/adminDashboard/jobseeker/JobseekerKPICards";
import { JobseekerBulkActionBar } from "@/components/adminDashboard/jobseeker/JobseekerBulkActionBar";
import { JobseekerFilterPanel } from "@/components/adminDashboard/jobseeker/JobseekerFilterPanel";
import { JobseekerDetailDrawer } from "@/components/adminDashboard/jobseeker/JobseekerDetailDrawer";
import { JobseekersTable } from "@/components/adminDashboard/jobseeker/JobseekersTable";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { activateJobseeker, suspendJobseeker, banJobseeker, deleteJobseeker } from "@/lib/api/adminJobseekers";
import supabase from "@/lib/supabase";
import { useJobseekersMetrics, useJobseekersList, useJobseekerActions } from "@/hooks/admin/useAdminJobseekers";

export default function Jobseekers() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedJobseeker, setSelectedJobseeker] = useState<Jobseeker | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState("lastActive");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [makeAdminTarget, setMakeAdminTarget] = useState<Jobseeker | null>(null);
  const [promoting, setPromoting] = useState(false);

  const { invalidateJobseekers } = useJobseekerActions();
  const { data: metricsData, isLoading: isLoadingMetrics } = useJobseekersMetrics();
  const { data: listData, isLoading: isLoadingJobseekers } = useJobseekersList({
    page,
    limit,
    search: debouncedSearch,
    sortField,
    sortDir,
  });

  const jobseekers = listData?.data ?? [];
  const total = listData?.meta?.total ?? 0;
  const totalPages = listData?.meta?.totalPages ?? 1;
  const metrics = metricsData as JobseekerMetrics | undefined;
  // The open drawer follows the refreshed row, so a change made inside it
  // (e.g. giving Premium) shows in its header too.
  const openJobseeker = selectedJobseeker
    ? jobseekers.find((j) => j.id === selectedJobseeker.id) ?? selectedJobseeker
    : null;

  const confirmMakeAdmin = async () => {
    if (!makeAdminTarget) return;
    setPromoting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Your session expired — sign in again.');

      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1'}/auth/role`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userId: makeAdminTarget.id, role: 'ADMIN' }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to promote user');
      }
      toast.success(`${makeAdminTarget.name} is now an admin`);
      setMakeAdminTarget(null);
      invalidateJobseekers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to promote user');
    } finally {
      setPromoting(false);
    }
  };

  // Debounce search → reset to page 1.
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
    setPage(1);
  };

  const handleActivate = async (js: Jobseeker) => {
    try {
      await activateJobseeker(js.id);
      toast.success(`${js.name} activated`);
      invalidateJobseekers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to activate");
    }
  };

  const handleSuspend = async (js: Jobseeker) => {
    try {
      await suspendJobseeker(js.id);
      toast.success(`${js.name} suspended`);
      invalidateJobseekers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to suspend");
    }
  };

  const handleDelete = async (js: Jobseeker) => {
    try {
      await deleteJobseeker(js.id);
      toast.success(`${js.name} deleted`);
      invalidateJobseekers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const bulkAction = async (fn: (id: string) => Promise<void>, verb: string) => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    try {
      await Promise.all(ids.map(fn));
      toast.success(`${ids.length} jobseeker${ids.length !== 1 ? "s" : ""} ${verb}`);
      setSelectedIds(new Set());
      invalidateJobseekers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    }
  };

  return (
    <>
      <div className="space-y-6 p-6 lg:p-8 max-w-[1400px]">
        {/* Header */}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold  text-foreground">
            Jobseekers
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Monitor and manage jobseeker accounts
          </p>
        </div>

        {/* Action Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search name, email, ID…"
              className="h-10 w-64 pl-9 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 rounded-full"
            onClick={() => setFilterOpen(true)}
          >
            <SlidersHorizontal className=" h-4 w-4" />
            Filters
          </Button>
          <Button variant="outline" size="sm" className="gap-2 rounded-full">
            <Download className="mr-1.5 h-4 w-4" />
            Export CSV
          </Button>
          <Button
            variant="default"
            size="sm"
            className="gap-2 rounded-full"
            onClick={() => navigate("/admin/jobseekers/add")}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add Jobseeker
          </Button>
        </div>
        </div>

         <Separator  />

        {/* KPIs */}
        <JobseekerKPICards metrics={metrics || undefined} />

        {/* Bulk Action Bar */}
        <JobseekerBulkActionBar
          count={selectedIds.size}
          onClear={() => setSelectedIds(new Set())}
          onActivate={() => bulkAction(activateJobseeker, "activated")}
          onSuspend={() => bulkAction(suspendJobseeker, "suspended")}
          onBan={() => bulkAction(banJobseeker, "banned")}
          onDelete={() => bulkAction(deleteJobseeker, "deleted")}
        />

        {/* Table */}
        <JobseekersTable
          jobseekers={jobseekers}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          onJobseekerClick={setSelectedJobseeker}
          sortField={sortField}
          sortDir={sortDir}
          onSort={handleSort}
          isLoading={isLoadingJobseekers}
          onMakeAdmin={setMakeAdminTarget}
          onActivate={handleActivate}
          onSuspend={handleSuspend}
          onDelete={handleDelete}
          page={page}
          limit={limit}
          total={total}
          totalPages={totalPages}
          onPageChange={setPage}
          onLimitChange={(l) => { setLimit(l); setPage(1); }}
        />
      </div>

      {/* Panels */}
      <JobseekerFilterPanel open={filterOpen} onClose={() => setFilterOpen(false)} />
      <JobseekerDetailDrawer
        jobseeker={openJobseeker}
        open={!!openJobseeker}
        onClose={() => setSelectedJobseeker(null)}
      />

      {/* Make-admin confirmation */}
      <AlertDialog open={!!makeAdminTarget} onOpenChange={(open) => !open && setMakeAdminTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Make this user an admin?</AlertDialogTitle>
            <AlertDialogDescription>
              {makeAdminTarget && (
                <>
                  <span className="font-medium text-foreground">{makeAdminTarget.name}</span> ({makeAdminTarget.email})
                  will get full admin access to the dashboard, including managing users, jobs, and verifications.
                  This takes effect on their next sign-in.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={promoting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmMakeAdmin(); }} disabled={promoting}>
              {promoting ? 'Promoting…' : 'Make admin'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
