import { useState, useMemo, useCallback } from "react";
import {
  Search, Filter, Download, MoreHorizontal, ChevronUp, ChevronDown,
  CheckSquare, Flag, Trash2, Eye, ArrowUpRight,
} from "lucide-react";
import { ReportFilterPanel, ReportFilters } from "@/components/adminDashboard/reports/ReportFilterPanel";
import { ReportDetailPanel } from "@/components/adminDashboard/reports/ReportDetailPanel";
import { mockReports, Report, ReportSeverity, ReportStatus } from "@/data/admin/reports/reports";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";

type SortKey = "createdAt" | "severity" | "entity";
type SortDir = "asc" | "desc";

const severityWeight: Record<ReportSeverity, number> = { Low: 0, Medium: 1, High: 2 };

const severityBadge: Record<ReportSeverity, string> = {
  Low:
    "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400",
  Medium:
    "bg-amber-500/10 text-amber-600 border border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400",
  High:
    "bg-rose-500/10 text-rose-600 border border-rose-500/20 dark:bg-rose-500/20 dark:text-rose-400",
};

const statusBadge: Record<ReportStatus, string> = {
  Open:
    "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400",
  "In Review":
    "bg-blue-500/10 text-blue-600 border border-blue-500/20 dark:bg-blue-500/20 dark:text-blue-400",
  Escalated:
    "bg-amber-500/10 text-amber-600 border border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400",
  Resolved:
    "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400",
  Dismissed:
    "bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400",
};

export default function ReportsPage() {
  const isMobile = useIsMobile();
  const [reports, setReports] = useState<Report[]>(() => [...mockReports]);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [drawerReport, setDrawerReport] = useState<Report | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Report | null>(null);
  const [filters, setFilters] = useState<ReportFilters>({ statuses: [], severities: [], types: [] });

  // Stats (derived from live state)
  const totalReports = reports.length;
  const openCases = reports.filter(r => r.status === "Open" || r.status === "In Review").length;
  const highRisk = reports.filter(r => r.severity === "High").length;
  const resolvedToday = reports.filter(r => r.status === "Resolved").length;

  const stats = [
    { label: "Total Reports", value: totalReports.toLocaleString(), trend: "+6.2% this week" },
    { label: "Open Cases", value: openCases.toString() },
    { label: "High Risk", value: highRisk.toString() },
    { label: "Resolved Today", value: resolvedToday.toString() },
  ];

  const filtered = useMemo(() => {
    let data = [...reports];
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(r =>
        r.id.toLowerCase().includes(q) ||
        r.entity.name.toLowerCase().includes(q) ||
        r.reason.toLowerCase().includes(q) ||
        r.type.toLowerCase().includes(q)
      );
    }
    if (filters.statuses.length) data = data.filter(r => filters.statuses.includes(r.status));
    if (filters.severities.length) data = data.filter(r => filters.severities.includes(r.severity));
    if (filters.types.length) data = data.filter(r => filters.types.includes(r.type));

    data.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "createdAt") cmp = a.createdAt.localeCompare(b.createdAt);
      else if (sortKey === "severity") cmp = severityWeight[a.severity] - severityWeight[b.severity];
      else if (sortKey === "entity") cmp = a.entity.name.localeCompare(b.entity.name);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return data;
  }, [reports, search, filters, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(r => r.id)));
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
    (filters.severities.length > 0 ? 1 : 0) +
    (filters.types.length > 0 ? 1 : 0);

  const handleDelete = () => {
    if (deleteTarget) {
      const prevState = reports;
      const target = deleteTarget;
      setReports(prev => prev.filter(r => r.id !== target.id));

      toast.success("Report deleted", {
        description: `${target.id} has been removed.`,
        action: {
          label: "Undo",
          onClick: () => {
            setReports(prevState);
            toast.info("Action undone", { description: `${target.id} restored.` });
          },
        },
      });
      setDeleteTarget(null);
    }
  };

  const handleBulkAction = (type: "resolve" | "escalate" | "dismiss" | "delete") => {
    const ids = new Set(selectedIds);
    const count = ids.size;
    const prevState = reports;

    if (type === "delete") {
      setReports(prev => prev.filter(r => !ids.has(r.id)));
    } else if (type === "dismiss") {
      setReports(prev => prev.map(r => ids.has(r.id) ? { ...r, status: "Dismissed" as ReportStatus } : r));
    } else if (type === "resolve") {
      setReports(prev => prev.map(r => ids.has(r.id) ? { ...r, status: "Resolved" as ReportStatus } : r));
    } else if (type === "escalate") {
      setReports(prev => prev.map(r => ids.has(r.id) ? { ...r, status: "Escalated" as ReportStatus } : r));
    }

    const labels: Record<string, string> = {
      resolve: "Resolved",
      escalate: "Escalated",
      dismiss: "Dismissed",
      delete: "Deleted",
    };

    toast.success(`${labels[type]} ${count} reports`, {
      action: {
        label: "Undo",
        onClick: () => {
          setReports(prevState);
          toast.info("Bulk action undone", { description: `${count} reports restored.` });
        },
      },
    });
    setSelectedIds(new Set());
  };

  const handleDrawerAction = useCallback((type: "suspend" | "delete" | "escalate" | "mark-safe", report: Report) => {
    const prevState = reports;

    if (type === "delete") {
      setReports(prev => prev.filter(r => r.id !== report.id));
      setDrawerReport(null);
      toast.success("Report deleted", {
        description: `${report.entity.name} — ${report.id}`,
        action: {
          label: "Undo",
          onClick: () => {
            setReports(prevState);
            toast.info("Action undone", { description: `${report.id} restored.` });
          },
        },
      });
    } else if (type === "escalate") {
      setReports(prev => prev.map(r => r.id === report.id ? { ...r, status: "Escalated" as ReportStatus } : r));
      setDrawerReport(prev => prev ? { ...prev, status: "Escalated" as ReportStatus } : null);
      toast.success("Report escalated", {
        description: `${report.id} escalated for senior review.`,
        action: {
          label: "Undo",
          onClick: () => {
            setReports(prevState);
            setDrawerReport(prev => prev?.id === report.id ? { ...prev, status: report.status } : prev);
            toast.info("Action undone", { description: `${report.id} restored.` });
          },
        },
      });
    } else if (type === "mark-safe") {
      setReports(prev => prev.map(r => r.id === report.id ? { ...r, status: "Resolved" as ReportStatus } : r));
      setDrawerReport(prev => prev ? { ...prev, status: "Resolved" as ReportStatus } : null);
      toast.success("Report marked as safe", {
        description: report.id,
        action: {
          label: "Undo",
          onClick: () => {
            setReports(prevState);
            setDrawerReport(prev => prev?.id === report.id ? { ...prev, status: report.status } : prev);
            toast.info("Action undone", { description: `${report.id} restored.` });
          },
        },
      });
    } else if (type === "suspend") {
      toast.success("Account suspended", {
        description: `${report.entity.name} — ${report.id}`,
        action: {
          label: "Undo",
          onClick: () => {
            toast.info("Suspension reversed", { description: `${report.entity.name} account restored.` });
          },
        },
      });
    }
  }, [reports]);

  return (
    <>
      <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-[1400px]">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">Reports & Abuse Center</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Monitor flagged content, investigate reports, and enforce platform policies</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search reports..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-9 w-64 pl-9 border border-border"
              />
            </div>
            <Button variant="default" size="sm" className="gap-1.5 relative rounded-full" onClick={() => setFilterOpen(true)}>
              <Filter className="h-4 w-4" /> Filters
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-accent-foreground text-[10px] font-bold">
                  {activeFilterCount}
                </span>
              )}
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 rounded-full" onClick={() => toast("Export started", { description: "Your report CSV will download shortly." })}>
              <Download className="h-4 w-4" /> Export
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border rounded-lg overflow-hidden border border-border">
          {stats.map(stat => (
            <div key={stat.label} className="bg-card px-5 py-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{stat.label}</p>
              <p className="text-2xl font-semibold text-card-foreground mt-1">{stat.value}</p>
              {stat.trend && <p className="text-xs text-muted-foreground mt-0.5">{stat.trend}</p>}
            </div>
          ))}
        </div>

        {/* Bulk Action Bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-secondary border border-border p-3">
            <span className="text-sm font-medium text-card-foreground">{selectedIds.size} selected</span>
            <div className="flex gap-1 ml-auto">
              <Button variant="ghost" size="sm" className="gap-1 text-xs rounded-full" onClick={() => handleBulkAction("resolve")}><CheckSquare className="h-3.5 w-3.5" /> Resolve</Button>
              <Button variant="ghost" size="sm" className="gap-1 text-xs rounded-full" onClick={() => handleBulkAction("escalate")}><ArrowUpRight className="h-3.5 w-3.5" /> Escalate</Button>
              <Button variant="ghost" size="sm" className="gap-1 text-xs rounded-full" onClick={() => handleBulkAction("dismiss")}><Flag className="h-3.5 w-3.5" /> Dismiss</Button>
              <Button variant="ghost" size="sm" className="gap-1 text-xs text-destructive rounded-full" onClick={() => handleBulkAction("delete")}><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
            </div>
          </div>
        )}

        {/* Table */}
        {!isMobile ? (
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="px-4 py-3 w-10">
                      <Checkbox checked={selectedIds.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground cursor-pointer select-none" onClick={() => toggleSort("entity")}>
                      <span className="flex items-center gap-1">Entity <SortIcon field="entity" /></span>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden xl:table-cell max-w-[200px]">Reason</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground cursor-pointer select-none" onClick={() => toggleSort("severity")}>
                      <span className="flex items-center gap-1">Severity <SortIcon field="severity" /></span>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">Assigned</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground cursor-pointer select-none" onClick={() => toggleSort("createdAt")}>
                      <span className="flex items-center gap-1">Date <SortIcon field="createdAt" /></span>
                    </th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(report => (
                    <tr
                      key={report.id}
                      className={cn(
                        "border-b border-border last:border-b-0 hover:bg-secondary/30 transition-colors cursor-pointer",
                        selectedIds.has(report.id) && "bg-secondary/20"
                      )}
                      onClick={() => setDrawerReport(report)}
                    >
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <Checkbox checked={selectedIds.has(report.id)} onCheckedChange={() => toggleOne(report.id)} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{report.id}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-card-foreground">
                          {report.type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-card-foreground">{report.entity.name}</p>
                          <p className="text-xs text-muted-foreground">{report.entity.type}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell max-w-[200px]">
                        <p className="text-muted-foreground truncate" title={report.reason}>{report.reason}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", severityBadge[report.severity])}>
                          {report.severity}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", statusBadge[report.status])}>
                          {report.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{report.assignedTo || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{report.createdAt}</td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover">
                            <DropdownMenuItem onClick={() => setDrawerReport(report)}>
                              <Eye className="h-4 w-4 mr-2" /> View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem><ArrowUpRight className="h-4 w-4 mr-2" /> Escalate</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(report)}>
                              <Trash2 className="h-4 w-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                        No reports found matching your criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-border px-4 py-3 bg-secondary/30">
              <p className="text-xs text-muted-foreground">Showing {filtered.length} of {reports.length} reports</p>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" className="rounded-full" disabled>Previous</Button>
                <Button variant="outline" size="sm" className="rounded-full" disabled>Next</Button>
              </div>
            </div>
          </div>
        ) : (
          /* Mobile cards */
          <div className="space-y-3">
            {filtered.map(report => (
              <div
                key={report.id}
                className="rounded-lg bg-card border border-border p-4 space-y-2 cursor-pointer active:bg-secondary/50"
                onClick={() => setDrawerReport(report)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-card-foreground">{report.entity.name}</p>
                    <p className="text-xs text-muted-foreground">{report.type} · {report.id}</p>
                  </div>
                  <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", severityBadge[report.severity])}>
                    {report.severity}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 font-medium", statusBadge[report.status])}>
                    {report.status}
                  </span>
                  <span>{report.createdAt}</span>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="py-12 text-center text-muted-foreground text-sm">No reports found.</div>
            )}
          </div>
        )}
      </div>

      {/* Panels */}
      <ReportDetailPanel
        report={drawerReport}
        open={!!drawerReport}
        onClose={() => setDrawerReport(null)}
        onAction={handleDrawerAction}
      />
      <ReportFilterPanel open={filterOpen} onClose={() => setFilterOpen(false)} filters={filters} onFiltersChange={setFilters} />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete report {deleteTarget?.id}?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove this report. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
