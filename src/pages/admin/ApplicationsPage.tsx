import { useState, useEffect } from "react";
import {
  Search, Filter, Download, MoreHorizontal, ChevronUp, ChevronDown,
  CheckSquare, XCircle, Flag, Trash2, Bell, Eye,
} from "lucide-react";
import { toast } from "sonner";
import { KpiCard } from "@/components/adminDashboard/applications/KpiCard";
import { StatusBadge, RiskBadge, ScreeningScoreBar } from "@/components/adminDashboard/applications/StatusBadge";
import { ApplicationDrawer } from "@/components/adminDashboard/applications/ApplicationDrawer";
import { FilterPanel } from "@/components/adminDashboard/applications/FilterPanel";
import { AdminPagination } from "@/components/adminDashboard/AdminPagination";
import { Application, ApplicationStatus } from "@/data/admin/applications/applications";
import { setApplicationStatus, deleteApplication } from "@/lib/api/adminApplications";
import { useApplicationsList, useApplicationsMetrics, useApplicationActions } from "@/hooks/admin/useAdminApplications";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Skeleton } from "@/components/ui/skeleton";

type SortKey = "appliedDate" | "applicant";
type SortDir = "asc" | "desc";
type DestructiveAction = { type: "flag" | "reject" | "delete"; app: Application } | null;

interface ApplicationMetrics {
  kpis: Array<{
    label: string;
    value: string;
    change: number;
    icon: string;
    trend: number[];
  }>;
  summary: {
    totalApplications: number;
    applicationsToday: number;
    pendingReview: number;
    flagged: number;
    withdrawn: number;
    interviewsScheduled: number;
  };
}

const kpis = [
  { label: "Total Applications", value: "0", trend: { value: "0%", direction: "neutral" as const } },
  { label: "Today", value: "0", trend: { value: "0%", direction: "neutral" as const } },
  { label: "Pending Review", value: "0", trend: { value: "0%", direction: "neutral" as const } },
  { label: "Flagged", value: "0", trend: { value: "0%", direction: "neutral" as const } },
  { label: "Withdrawn", value: "0", trend: { value: "0%", direction: "neutral" as const } },
  { label: "Interviews Scheduled", value: "0", trend: { value: "0%", direction: "neutral" as const } },
];

const actionConfig = {
  flag: {
    title: "Flag this application?",
    description: "This will flag the application for review by the moderation team. The applicant will not be notified immediately.",
    confirm: "Flag",
    onSuccess: "Application flagged",
  },
  reject: {
    title: "Reject this application?",
    description: "This will mark the application as rejected. The applicant may be notified depending on employer settings.",
    confirm: "Reject",
    onSuccess: "Application rejected",
  },
  delete: {
    title: "Delete this application?",
    description: "This will permanently delete the application. This action cannot be undone.",
    confirm: "Delete",
    onSuccess: "Application deleted",
  },
};

function SkeletonTableRow() {
  return (
    <tr className="border-b border-border last:border-b-0">
      <td className="px-4 py-3">
        <Skeleton className="h-4 w-4 rounded" />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="space-y-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <Skeleton className="h-4 w-36" />
      </td>
      <td className="px-4 py-3 hidden lg:table-cell">
        <Skeleton className="h-4 w-28" />
      </td>
      <td className="px-4 py-3 hidden xl:table-cell">
        <Skeleton className="h-4 w-24" />
      </td>
      <td className="px-4 py-3">
        <Skeleton className="h-4 w-20" />
      </td>
      <td className="px-4 py-3">
        <Skeleton className="h-5 w-20 rounded-full" />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-2 w-12 rounded-full" />
        </div>
      </td>
      <td className="px-4 py-3 hidden lg:table-cell">
        <Skeleton className="h-4 w-10" />
      </td>
      <td className="px-4 py-3">
        <Skeleton className="h-8 w-8 rounded" />
      </td>
    </tr>
  );
}

export default function ApplicationsPage() {
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("appliedDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [drawerApp, setDrawerApp] = useState<Application | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<DestructiveAction>(null);
  const [filters, setFilters] = useState<{
    statuses: ApplicationStatus[];
    flaggedOnly: boolean;
  }>({ statuses: [], flaggedOnly: false });

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const { invalidateApplications } = useApplicationActions();
  const { data: metricsData, isLoading: isLoadingMetrics } = useApplicationsMetrics();
  const { data: listData, isLoading: isLoadingApplications } = useApplicationsList({
    page,
    limit,
    search: debouncedSearch,
    filters: { statuses: filters.statuses, flaggedOnly: filters.flaggedOnly },
    sort: sortKey,
    sortDir,
  });

  const applications = listData?.data ?? [];
  const total = listData?.meta?.total ?? 0;
  const totalPages = listData?.meta?.totalPages ?? 1;
  const metrics = metricsData;

  // Debounce search → reset to first page on change.
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const applyAction = async (type: "flag" | "reject" | "delete", targetApp: Application) => {
    const newStatus: ApplicationStatus = type === "flag" ? "Flagged" : "Rejected";
    try {
      if (type === "delete") {
        await deleteApplication(targetApp.id);
        if (drawerApp?.id === targetApp.id) setDrawerApp(null);
      } else {
        await setApplicationStatus(targetApp.id, newStatus);
        if (drawerApp?.id === targetApp.id) {
          setDrawerApp(prev => prev ? { ...prev, status: newStatus } : null);
        }
      }
      toast.success(actionConfig[type].onSuccess, {
        description: `${targetApp.applicant.name} — ${targetApp.id}`,
      });
      invalidateApplications();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    }
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
    setPage(1);
  };

  const toggleAll = () => {
    if (selectedIds.size === applications.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(applications.map(a => a.id)));
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const SortIcon = ({ field }: { field: SortKey }) => {
    if (sortKey !== field) return null;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  };

  const activeFilterCount = (filters.statuses.length > 0 ? 1 : 0) +
    (filters.flaggedOnly ? 1 : 0);

  const handleConfirmAction = () => {
    if (pendingAction) {
      applyAction(pendingAction.type, pendingAction.app);
      setPendingAction(null);
    }
  };

  const handleBulkAction = async (type: "flag" | "reject" | "delete") => {
    const idList = [...selectedIds];
    const count = idList.length;
    const newStatus: ApplicationStatus = type === "flag" ? "Flagged" : "Rejected";

    try {
      if (type === "delete") {
        await Promise.all(idList.map((id) => deleteApplication(id)));
      } else {
        await Promise.all(idList.map((id) => setApplicationStatus(id, newStatus)));
      }
      toast.success(`${actionConfig[type].onSuccess} (${count} applications)`);
      setSelectedIds(new Set());
      invalidateApplications();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk action failed");
    }
  };

  const handleDrawerAction = (type: "flag" | "reject" | "delete", app: Application) => {
    applyAction(type, app);
    if (type === "delete") {
      setDrawerApp(null);
    }
  };

  return (
    <>
      <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-[1400px]">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">Applications</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Monitor and manage all job applications</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-9 w-64 pl-9 border border-border"
              />
            </div>
            <Button variant="default" size="sm" className="gap-1.5 relative" onClick={() => setFilterOpen(true)}>
              <Filter className="h-4 w-4" /> Filters
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-accent-foreground text-[10px] font-bold">
                  {activeFilterCount}
                </span>
              )}
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast("Export started", { description: "Your CSV file will download shortly." })}>
              <Download className="h-4 w-4" /> Export
            </Button>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {(metrics?.kpis || kpis).map(kpi => <KpiCard key={kpi.label} {...kpi} />)}
        </div>

        {/* Bulk Action Bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-secondary border border-border p-3 shadow-card">
            <span className="text-sm font-medium text-card-foreground">{selectedIds.size} selected</span>
            <div className="flex gap-1 ml-auto">
              <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => { toast.success(`${selectedIds.size} applications marked as reviewed`); setSelectedIds(new Set()); }}><CheckSquare className="h-3.5 w-3.5" /> Reviewed</Button>
              <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => handleBulkAction("flag")}><Flag className="h-3.5 w-3.5" /> Flag</Button>
              <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => handleBulkAction("reject")}><XCircle className="h-3.5 w-3.5" /> Reject</Button>
              <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => { toast.success(`Notification sent to ${selectedIds.size} applicants`); setSelectedIds(new Set()); }}><Bell className="h-3.5 w-3.5" /> Notify</Button>
              <Button variant="ghost" size="sm" className="gap-1 text-xs text-destructive" onClick={() => handleBulkAction("delete")}><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
            </div>
          </div>
        )}

        {/* Table / Card View */}
        {!isMobile ? (
          <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-secondary border-b border-border">
                    <th className="px-4 py-3 w-10">
                      <Checkbox
                        checked={selectedIds.size === applications.length && applications.length > 0}
                        onCheckedChange={toggleAll}
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground cursor-pointer select-none" onClick={() => toggleSort("applicant")}>
                      <span className="flex items-center gap-1">Applicant <SortIcon field="applicant" /></span>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Job Title</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">Employer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden xl:table-cell">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground cursor-pointer select-none" onClick={() => toggleSort("appliedDate")}>
                      <span className="flex items-center gap-1">Applied <SortIcon field="appliedDate" /></span>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Score</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">Risk</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingApplications ? (
                    // Render skeleton rows while loading
                    Array.from({ length: 10 }).map((_, index) => (
                      <SkeletonTableRow key={`skeleton-${index}`} />
                    ))
                  ) : applications.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                        No applications found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    applications.map(app => (
                      <tr
                        key={app.id}
                        className={cn(
                          "border-b border-border last:border-b-0 hover:bg-secondary/50 transition-colors cursor-pointer",
                          selectedIds.has(app.id) && "bg-secondary/30"
                        )}
                        onClick={() => setDrawerApp(app)}
                      >
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <Checkbox checked={selectedIds.has(app.id)} onCheckedChange={() => toggleOne(app.id)} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-primary text-primary-foreground text-xs">{app.applicant.avatar}</AvatarFallback>
                            </Avatar>
                            <div className="leading-tight">
                              <p className="font-medium text-card-foreground">{app.applicant.name}</p>
                              {app.applicant.location !== "Unknown" && (
                                <p className="text-xs text-muted-foreground">{app.applicant.location}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-card-foreground">{app.job.title}</td>
                        <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{app.job.employer}</td>
                        <td className="px-4 py-3 text-muted-foreground hidden xl:table-cell">{app.job.location}</td>
                        <td className="px-4 py-3 text-muted-foreground">{app.appliedDate}</td>
                        <td className="px-4 py-3"><StatusBadge status={app.status} /></td>
                        <td className="px-4 py-3"><ScreeningScoreBar score={app.screeningScore} /></td>
                        <td className="px-4 py-3 hidden lg:table-cell"><RiskBadge level={app.riskLevel} reason={app.riskReason} /></td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-popover">
                              <DropdownMenuItem onClick={() => setDrawerApp(app)}>
                                <Eye className="h-4 w-4 mr-2" /> View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setPendingAction({ type: "flag", app })}>
                                <Flag className="h-4 w-4 mr-2" /> Flag
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setPendingAction({ type: "reject", app })}>
                                <XCircle className="h-4 w-4 mr-2" /> Reject
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => setPendingAction({ type: "delete", app })}>
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {/* Pagination footer */}
            <AdminPagination
              page={page}
              limit={limit}
              total={total}
              totalPages={totalPages}
              onPageChange={setPage}
              onLimitChange={(l) => { setLimit(l); setPage(1); }}
              label="applications"
            />
          </div>
        ) : (
          /* Mobile: Stacked cards */
          <div className="space-y-3">
            {applications.map(app => (
              <div
                key={app.id}
                className="rounded-xl bg-card border border-border p-4 shadow-card space-y-2 cursor-pointer active:bg-secondary/50"
                onClick={() => setDrawerApp(app)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">{app.applicant.avatar}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-card-foreground">{app.applicant.name}</p>
                      <p className="text-xs text-muted-foreground">{app.job.title}</p>
                    </div>
                  </div>
                  <StatusBadge status={app.status} />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{app.appliedDate}</span>
                  <ScreeningScoreBar score={app.screeningScore} />
                </div>
              </div>
            ))}
            {applications.length === 0 && !isLoadingApplications && (
              <div className="py-12 text-center text-muted-foreground text-sm">No applications found.</div>
            )}
            {applications.length > 0 && (
              <AdminPagination
                page={page}
                limit={limit}
                total={total}
                totalPages={totalPages}
                onPageChange={setPage}
                onLimitChange={(l) => { setLimit(l); setPage(1); }}
                label="applications"
              />
            )}
          </div>
        )}
      </div>

      {/* Drawers */}
      <ApplicationDrawer
        application={drawerApp}
        open={!!drawerApp}
        onClose={() => setDrawerApp(null)}
        onAction={handleDrawerAction}
      />
      <FilterPanel
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filters}
        onFiltersChange={(f) => { setFilters(f); setPage(1); }}
      />

      {/* Confirmation Dialog for table/dropdown actions */}
      {pendingAction && (
        <AlertDialog open={!!pendingAction} onOpenChange={v => { if (!v) setPendingAction(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{actionConfig[pendingAction.type].title}</AlertDialogTitle>
              <AlertDialogDescription>
                <span className="font-medium text-foreground">{pendingAction.app.applicant.name}</span> — {actionConfig[pendingAction.type].description}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleConfirmAction}
              >
                {actionConfig[pendingAction.type].confirm}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
