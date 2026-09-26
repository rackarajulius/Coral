import { useState, useEffect } from "react";
import { EmployerDetailDrawer } from "@/components/adminDashboard/employers/EmployerDetailDrawer";
import { EmployerStatusBadge } from "@/components/adminDashboard/employers/EmployerStatusBadge";
import { KPICard } from "@/components/adminDashboard/overview/KPICard";
import { EmployersFilters } from "@/components/adminDashboard/employers/EmployersFilters";
import { AdminPagination } from "@/components/adminDashboard/AdminPagination";
import { Employer } from "@/data/admin/employer/employers-data";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Building2,
  Clock,
  Ban,
  CheckCircle2,
  Search,
  Plus,
  Download,
  MoreHorizontal,
  ArrowUpDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import supabase from "@/lib/supabase";
import { approveEmployer, suspendEmployer, banEmployer, deleteEmployer } from "@/lib/api/adminEmployers";
import { timeAgo } from "@/lib/timeAgo";
import { useEmployersMetrics, useEmployersList, useEmployerActions } from "@/hooks/admin/useAdminEmployers";

type SortKey = "company" | "jobsPosted" | "joinedDate";
type DestructiveAction = { type: "suspend" | "ban" | "delete"; label: string; employerName: string; ids: string[] };

const actionConfig = {
  suspend: {
    title: "Suspend Employer",
    description: (name: string) => `Are you sure you want to suspend "${name}"? This will temporarily disable their account and all active job listings.`,
    confirmLabel: "Suspend",
  },
  ban: {
    title: "Ban Employer",
    description: (name: string) => `Are you sure you want to permanently ban "${name}"? This action will remove all their job listings and prevent future access. This cannot be undone.`,
    confirmLabel: "Ban Account",
  },
  delete: {
    title: "Delete Employer",
    description: (name: string) => `Are you sure you want to permanently delete "${name}"? All associated data, job listings, and applications will be removed. This action cannot be undone.`,
    confirmLabel: "Delete",
  },
};

export default function Employers() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawerEmployer, setDrawerEmployer] = useState<Employer | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("joinedDate");
  const [sortAsc, setSortAsc] = useState(false);
  const [filters, setFilters] = useState({ status: "all", industry: "all" });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [destructiveAction, setDestructiveAction] = useState<DestructiveAction | null>(null);

  const { invalidateEmployers } = useEmployerActions();
  const { data: metricsData, isLoading: isLoadingMetrics } = useEmployersMetrics();
  const { data: listData, isLoading: isLoadingEmployers } = useEmployersList({
    page,
    limit,
    search: debouncedSearch,
    sortKey,
    sortAsc,
    filters,
  });

  const employers = listData?.data ?? [];
  const total = listData?.meta?.total ?? 0;
  const totalPages = listData?.meta?.totalPages ?? 1;
  const metrics = metricsData;

  // Debounce search → reset to page 1.
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
    setPage(1);
  };

  const toggleAll = () => {
    if (selected.size === employers.length) setSelected(new Set());
    else setSelected(new Set(employers.map((e) => e.id)));
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const handleApprove = async (emp: Employer) => {
    try {
      await approveEmployer(emp.id);
      toast.success(`${emp.company} approved`);
      invalidateEmployers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve');
    }
  };

  const handleConfirmDestructive = async () => {
    if (!destructiveAction) return;
    const { type, ids, employerName } = destructiveAction;
    const action = type === "suspend" ? suspendEmployer : type === "ban" ? banEmployer : deleteEmployer;
    const verb = type === "suspend" ? "suspended" : type === "ban" ? "banned" : "deleted";
    try {
      await Promise.all(ids.map((id) => action(id)));
      toast.success(`${employerName} ${verb}`);
      setDestructiveAction(null);
      setSelected(new Set());
      if (drawerEmployer && ids.includes(drawerEmployer.id)) setDrawerEmployer(null);
      invalidateEmployers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    }
  };

  const handleBulkApprove = async () => {
    try {
      await Promise.all([...selected].map((id) => approveEmployer(id)));
      toast.success(`${selected.size} employer${selected.size !== 1 ? "s" : ""} approved`);
      setSelected(new Set());
      invalidateEmployers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve');
    }
  };

  const handleBulkSuspend = () => {
    setDestructiveAction({ type: "suspend", label: "Suspend", employerName: `${selected.size} employer${selected.size !== 1 ? "s" : ""}`, ids: [...selected] });
  };

  const handleBulkBan = () => {
    setDestructiveAction({ type: "ban", label: "Ban", employerName: `${selected.size} employer${selected.size !== 1 ? "s" : ""}`, ids: [...selected] });
  };

  // Sparkline data for a KPI card, looked up from the backend metrics by label.
  const trendFor = (cardLabel: string): number[] =>
    metrics?.kpis?.find((k: any) => k.label === cardLabel)?.trend ?? [];

  return (
    <>
      <div className="p-6 lg:p-8 space-y-6 max-w-[1400px]">
        {/* Header */}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Employers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage, review, approve, and monitor employer accounts
          </p>
        </div>

         <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search company or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-64 h-9"
            />
          </div>
          <EmployersFilters filters={filters} onFiltersChange={(f) => { setFilters(f); setPage(1); }} />
          <Button variant="outline" size="sm" className="gap-2 rounded-full">
            <Download className="h-4 w-4" /> Export
          </Button>
          <Button size="sm" className="gap-2 rounded-full" variant="default" onClick={() => navigate("/admin/employers/add")}>
            <Plus className="h-4 w-4" /> Add Employer
          </Button>
        </div>
       </div>

<Separator  />

        {/* KPIs */}
         <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
           <KPICard
             label="Active Employers"
             value={(metrics?.summary?.activeEmployers ?? 0).toLocaleString()}
             change={0}
             icon={<Building2 className="h-4 w-4" />}
             trend={[]}
           />
           <KPICard
             label="Pending Approval"
             value={(metrics?.summary?.pendingApproval ?? 0).toLocaleString()}
             change={0}
             icon={<Clock className="h-4 w-4" />}
             trend={trendFor("Pending Approval")}
             tone="negative"
           />
           <KPICard
             label="Verified"
             value={(metrics?.summary?.verified ?? 0).toLocaleString()}
             change={0}
             icon={<CheckCircle2 className="h-4 w-4" />}
             trend={[]}
           />
           <KPICard
             label="Suspended Employers"
             value={(metrics?.summary?.suspendedEmployers ?? 0).toLocaleString()}
             change={0}
             icon={<Ban className="h-4 w-4" />}
             trend={trendFor("Suspended Employers")}
             tone="negative"
           />
         </div>

        {/* Bulk actions */}
        {selected.size > 0 && (
          <div className="flex items-center gap-3 rounded-lg border border-accent/30 bg-accent/5 px-4 py-2.5 text-sm animate-fade-in">
            <span className="font-medium text-foreground">{selected.size} selected</span>
            <Button variant="outline" size="sm" className="rounded-full" onClick={handleBulkApprove}>Approve</Button>
            <Button variant="outline" size="sm" className="text-warning border-warning/30 rounded-full" onClick={handleBulkSuspend}>Suspend</Button>
            <Button variant="destructive" size="sm" className="rounded-full" onClick={handleBulkBan}>Ban</Button>
            <Button variant="default" size="sm" className="rounded-full" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        )}

        {/* Table */}
        <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                  <TableHead className="w-12">
                    <Checkbox
                      checked={employers.length > 0 && selected.size === employers.length}
                      onCheckedChange={toggleAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort("company")} className="flex items-center gap-1 font-medium">
                      Company <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">Industry</TableHead>
                  <TableHead className="hidden md:table-cell">Location</TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort("jobsPosted")} className="flex items-center gap-1 font-medium">
                      Jobs <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Plan</TableHead>
                  <TableHead className="hidden xl:table-cell">
                    <button onClick={() => toggleSort("joinedDate")} className="flex items-center gap-1 font-medium">
                      Joined <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead className="hidden xl:table-cell">Last Active</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingEmployers ? (
                  // Loading skeleton rows
                  Array.from({ length: limit }).map((_, index) => (
                    <TableRow key={`skeleton-${index}`}>
                      <TableCell><div className="h-4 w-4 bg-muted animate-pulse rounded" /></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 bg-muted animate-pulse rounded-lg" />
                          <div className="space-y-1">
                            <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                            <div className="h-3 w-40 bg-muted animate-pulse rounded" />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell"><div className="h-4 w-20 bg-muted animate-pulse rounded" /></TableCell>
                      <TableCell className="hidden md:table-cell"><div className="h-4 w-24 bg-muted animate-pulse rounded" /></TableCell>
                      <TableCell><div className="h-4 w-8 bg-muted animate-pulse rounded" /></TableCell>
                      <TableCell><div className="h-5 w-16 bg-muted animate-pulse rounded-full" /></TableCell>
                      <TableCell className="hidden lg:table-cell"><div className="h-4 w-12 bg-muted animate-pulse rounded" /></TableCell>
                      <TableCell className="hidden xl:table-cell"><div className="h-4 w-20 bg-muted animate-pulse rounded" /></TableCell>
                      <TableCell><div className="h-8 w-8 bg-muted animate-pulse rounded" /></TableCell>
                    </TableRow>
                  ))
                ) : employers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                      No employers found.
                    </TableCell>
                  </TableRow>
                ) : (
                  employers.map((emp) => (
                    <TableRow
                      key={emp.id}
                      className={emp.status === "suspended" ? "bg-destructive/[0.03]" : undefined}
                      onClick={() => setDrawerEmployer(emp)}
                      role="button"
                      tabIndex={0}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selected.has(emp.id)}
                          onCheckedChange={() => toggleOne(emp.id)}
                          aria-label={`Select ${emp.company}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold shrink-0 overflow-hidden">
                            {emp.logoUrl ? (
                              <img
                                src={emp.logoUrl}
                                alt={emp.company}
                                className="h-full w-full object-cover"
                                onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement!.textContent = emp.logo; }}
                              />
                            ) : (
                              emp.logo
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">{emp.company}</p>
                            <p className="text-xs text-muted-foreground truncate">{emp.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">{emp.industry}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">{emp.location}</TableCell>
                      <TableCell className="font-medium">{emp.jobsPosted}</TableCell>
                      <TableCell><EmployerStatusBadge status={emp.status} /></TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span className="text-xs font-medium text-muted-foreground">{emp.plan}</span>
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-muted-foreground text-xs">
                        {new Date(emp.joinedDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-muted-foreground text-xs">{timeAgo(emp.lastActive)}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setDrawerEmployer(emp)}>View Details</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleApprove(emp)}>Approve</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-warning"
                              onClick={() => setDestructiveAction({ type: "suspend", label: "Suspend", employerName: emp.company, ids: [emp.id] })}
                            >
                              Suspend
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDestructiveAction({ type: "ban", label: "Ban", employerName: emp.company, ids: [emp.id] })}
                            >
                              Ban
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDestructiveAction({ type: "delete", label: "Delete", employerName: emp.company, ids: [emp.id] })}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <AdminPagination
            page={page}
            limit={limit}
            total={total}
            totalPages={totalPages}
            onPageChange={setPage}
            onLimitChange={(l) => { setLimit(l); setPage(1); }}
            label="employers"
          />
        </div>

        {/* Employer Detail Drawer */}
        <EmployerDetailDrawer
          employer={drawerEmployer}
          open={!!drawerEmployer}
          onOpenChange={(open) => !open && setDrawerEmployer(null)}
          onChanged={invalidateEmployers}
        />

        {/* Destructive Action Confirmation Modal */}
        <AlertDialog open={!!destructiveAction} onOpenChange={(open) => !open && setDestructiveAction(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{destructiveAction ? actionConfig[destructiveAction.type].title : ""}</AlertDialogTitle>
              <AlertDialogDescription>
                {destructiveAction ? actionConfig[destructiveAction.type].description(destructiveAction.employerName) : ""}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDestructive}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {destructiveAction ? actionConfig[destructiveAction.type].confirmLabel : "Confirm"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
}
