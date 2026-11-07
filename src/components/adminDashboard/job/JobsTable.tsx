import { useState } from "react";
import { MoreHorizontal, CheckCircle2, ArrowUpDown, Eye, Pause, Trash2, XCircle, Archive, type LucideIcon } from "lucide-react";
import type { AdminSettableJobStatus, Job } from "@/data/admin/job/jobs";
import { adminStatusActions, ARCHIVE_EXPLAINER, STATUS_ACTION_COPY } from "@/lib/api/adminJobs";

const ACTION_ICON: Record<AdminSettableJobStatus, LucideIcon> = {
  Active: CheckCircle2,
  Paused: Pause,
  Closed: XCircle,
  Archived: Archive,
};
import { StatusBadge, TypeBadge } from "./JobBadges";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminPagination } from "@/components/adminDashboard/AdminPagination";

interface JobsTableProps {
  jobs: Job[];
  onSelectJob: (job: Job) => void;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleAll: () => void;
  onBulkUpdateStatus?: (jobIds: string[], status: AdminSettableJobStatus) => void;
  onBulkDelete?: (jobIds: string[]) => void;
  onUpdateStatus?: (jobId: string, status: AdminSettableJobStatus) => void;
  onDelete?: (jobId: string) => void;
  isLoading?: boolean;
  sortField: "postedDate" | "applications" | null;
  sortDir: "asc" | "desc";
  onSort: (field: "postedDate" | "applications") => void;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}

function formatSalary(job: Job) {
  if (!job.salaryMin) return "—";
  if (job.salaryUnit) return `${job.currency}${job.salaryMin}${job.salaryUnit}`;
  if (job.salaryMax && job.salaryMax !== job.salaryMin)
    return `${job.currency}${(job.salaryMin / 1000).toFixed(0)}k–${job.currency}${(job.salaryMax / 1000).toFixed(0)}k`;
  return `${job.currency}${(job.salaryMin / 1000).toFixed(0)}k`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function SkeletonTableRow() {
  return (
    <tr className="h-16 border-b border-border/50">
      <td className="px-4">
        <Skeleton className="h-4 w-4 rounded" />
      </td>
      <td className="px-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded" />
          <div className="space-y-1">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      </td>
      <td className="hidden md:table-cell px-4">
        <Skeleton className="h-4 w-24" />
      </td>
      <td className="hidden lg:table-cell px-4">
        <Skeleton className="h-4 w-20" />
      </td>
      <td className="hidden lg:table-cell px-4">
        <Skeleton className="h-4 w-16" />
      </td>
      <td className="hidden xl:table-cell px-4">
        <Skeleton className="h-4 w-12" />
      </td>
      <td className="px-4">
        <Skeleton className="h-5 w-16 rounded-full" />
      </td>
      <td className="px-4">
        <Skeleton className="h-8 w-8 rounded" />
      </td>
    </tr>
  );
}

export function JobsTable({ jobs, onSelectJob, selectedIds, onToggleSelect, onToggleAll, onBulkUpdateStatus, onBulkDelete, onUpdateStatus, onDelete, isLoading = false, sortField, sortDir, onSort, page, limit, total, totalPages, onPageChange, onLimitChange }: JobsTableProps) {
  const [bulkConfirm, setBulkConfirm] = useState<"archive" | "delete" | null>(null);

  const handleSort = onSort;

  // Rows arrive already sorted from the server.
  const sortedJobs = jobs;

  const allSelected = jobs.length > 0 && selectedIds.length === jobs.length;

  return (
    <div className="bg-card rounded-2xl shadow-card overflow-hidden">
      {/* Bulk action bar */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-3 px-5 py-3 bg-secondary border-b border-border animate-fade-in">
          <span className="text-sm font-medium">{selectedIds.length} job{selectedIds.length > 1 ? "s" : ""} selected</span>
          <div className="flex gap-2 ml-auto">
            {/* No bulk Activate: whether a job may go live again (published
                before? deadline still ahead?) is a per-job answer. */}
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => onBulkUpdateStatus?.(selectedIds, "Paused")}>Pause</Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => onBulkUpdateStatus?.(selectedIds, "Closed")}>Close</Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setBulkConfirm("archive")}>Archive</Button>
            <Button size="sm" variant="outline" className="h-8 text-xs text-destructive hover:text-destructive" onClick={() => setBulkConfirm("delete")}>Delete</Button>
          </div>
        </div>
      )}

      <AlertDialog open={bulkConfirm !== null} onOpenChange={(v) => !v && setBulkConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkConfirm === "delete"
                ? `Delete ${selectedIds.length} job${selectedIds.length > 1 ? "s" : ""}?`
                : `Archive ${selectedIds.length} job${selectedIds.length > 1 ? "s" : ""}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkConfirm === "delete"
                ? "This will permanently remove the selected job listings. This action cannot be undone."
                : ARCHIVE_EXPLAINER}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={cn(
                bulkConfirm === "delete"
                  ? "bg-rose-500 text-white hover:bg-rose-500/90"
                  : "bg-emerald-500 text-white hover:bg-emerald-500/90"
              )}
              onClick={() => {
                if (bulkConfirm === "delete") {
                  onBulkDelete?.(selectedIds);
                } else {
                  onBulkUpdateStatus?.(selectedIds, "Archived");
                }
                setBulkConfirm(null);
              }}
            >
              {bulkConfirm === "delete" ? "Delete" : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/40">
              <th className="w-12 px-4 py-3">
                <Checkbox checked={allSelected} onCheckedChange={onToggleAll} />
              </th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Job Title</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Company</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden xl:table-cell">Location</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden xl:table-cell">Type</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden 2xl:table-cell">Salary</th>
              <th className="px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">
                <button onClick={() => handleSort("postedDate")} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                  Posted <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">
                <button onClick={() => handleSort("applications")} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                  Apps <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="w-14 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading && jobs.length === 0 ? (
              // Render skeleton rows while loading
              Array.from({ length: 10 }).map((_, index) => (
                <SkeletonTableRow key={`skeleton-${index}`} />
              ))
            ) : (
              sortedJobs.map((job) => (
              <tr
                key={job.id}
                className={cn(
                  "border-b border-border/50 transition-colors hover:bg-secondary/30 cursor-pointer h-16",
                  selectedIds.includes(job.id) && "bg-secondary/40"
                )}
              >
                <td className="px-4" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.includes(job.id)}
                    onCheckedChange={() => onToggleSelect(job.id)}
                  />
                </td>
                <td className="px-4" onClick={() => onSelectJob(job)}>
                  <div>
                    <p className="font-medium text-foreground">{job.title}</p>
                    <p className="text-xs text-muted-foreground lg:hidden">{job.company}</p>
                  </div>
                </td>
                <td className="px-4 text-muted-foreground hidden lg:table-cell" onClick={() => onSelectJob(job)}>
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-md bg-secondary flex items-center justify-center text-xs font-semibold text-muted-foreground shrink-0">
                      {job.company.charAt(0)}
                    </div>
                    <span className="truncate max-w-[160px]">{job.company}</span>
                  </div>
                </td>
                <td className="px-4 text-muted-foreground hidden xl:table-cell" onClick={() => onSelectJob(job)}>{job.location}</td>
                <td className="px-4 hidden xl:table-cell" onClick={() => onSelectJob(job)}><TypeBadge type={job.type} /></td>
                <td className="px-4 text-muted-foreground hidden 2xl:table-cell" onClick={() => onSelectJob(job)}>{formatSalary(job)}</td>
                <td className="px-4 text-muted-foreground text-center hidden lg:table-cell" onClick={() => onSelectJob(job)}>{formatDate(job.postedDate)}</td>
                <td className="px-4 text-center hidden md:table-cell" onClick={() => onSelectJob(job)}>
                  <span className="font-medium text-foreground">{job.applications}</span>
                </td>
                <td className="px-4" onClick={() => onSelectJob(job)}><StatusBadge status={job.status} /></td>
                <td className="px-4" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onSelectJob(job)}>
                        <Eye className="mr-2 h-3.5 w-3.5" /> View Details
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {adminStatusActions(job).map((next) => {
                        const Icon = ACTION_ICON[next];
                        return (
                          <DropdownMenuItem key={next} onClick={() => onUpdateStatus?.(job.id, next)}>
                            <Icon className="mr-2 h-3.5 w-3.5" /> {STATUS_ACTION_COPY[next].label}
                          </DropdownMenuItem>
                        );
                      })}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => onDelete?.(job.id)}>
                        <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
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

      {/* Pagination */}
      <AdminPagination
        page={page}
        limit={limit}
        total={total}
        totalPages={totalPages}
        onPageChange={onPageChange}
        onLimitChange={onLimitChange}
        label="jobs"
      />
    </div>
  );
}
