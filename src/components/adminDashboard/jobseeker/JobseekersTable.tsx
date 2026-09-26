import { useState } from "react";
import { ArrowUpDown, MoreHorizontal, CheckCircle2, ShieldOff, Trash2, Flag, Star, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Jobseeker, JobseekerStatus, RiskLevel } from "@/data/admin/jobseeker/jobs-data";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ConfirmModal, ConfirmModalVariant } from "@/components/ui/ConfirmModal";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminPagination } from "@/components/adminDashboard/AdminPagination";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const statusStyles: Record<JobseekerStatus, string> = {
  Active:
    "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400",

  Inactive:
    "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400",

  Suspended:
    "bg-rose-500/10 text-rose-600 border border-rose-500/20 dark:bg-rose-500/20 dark:text-rose-400",

  Flagged:
    "bg-amber-500/10 text-amber-600 border border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400",

  Deleted:
    "bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400",
};

const riskDot: Record<RiskLevel, string> = {
  Low: "bg-emerald-500",
  Medium: "bg-amber-500",
  High: "bg-rose-500",
};

interface JobseekersTableProps {
  jobseekers: Jobseeker[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onJobseekerClick: (js: Jobseeker) => void;
  sortField: string;
  sortDir: "asc" | "desc";
  onSort: (field: string) => void;
  isLoading?: boolean;
  onMakeAdmin?: (js: Jobseeker) => void;
  onActivate?: (js: Jobseeker) => void;
  onSuspend?: (js: Jobseeker) => void;
  onDelete?: (js: Jobseeker) => void;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}

function SkeletonTableRow() {
  return (
    <tr className="h-16 border-b border-border/50">
      <td className="px-4">
        <Skeleton className="h-4 w-4 rounded" />
      </td>
      {/* Name + avatar */}
      <td className="px-4">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="space-y-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      </td>
      {/* Email */}
      <td className="hidden px-4 md:table-cell">
        <Skeleton className="h-4 w-40" />
      </td>
      {/* Location */}
      <td className="hidden px-4 lg:table-cell">
        <Skeleton className="h-4 w-24" />
      </td>
      {/* Apps */}
      <td className="hidden px-4 text-center lg:table-cell">
        <Skeleton className="h-4 w-8 mx-auto" />
      </td>
      {/* Saved */}
      <td className="hidden px-4 text-center xl:table-cell">
        <Skeleton className="h-4 w-6 mx-auto" />
      </td>
      {/* Profile completion */}
      <td className="hidden px-4 xl:table-cell">
        <div className="w-24 space-y-1">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-1.5 w-full" />
        </div>
      </td>
      {/* Last Active */}
      <td className="hidden px-4 text-center lg:table-cell">
        <Skeleton className="h-4 w-16 mx-auto" />
      </td>
      {/* Status */}
      <td className="px-4">
        <Skeleton className="h-6 w-16 rounded-full" />
      </td>
      {/* Risk */}
      <td className="hidden px-4 xl:table-cell">
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-2 w-2 rounded-full" />
          <Skeleton className="h-3 w-8" />
          <Skeleton className="h-3 w-6" />
        </div>
      </td>
      {/* Actions */}
      <td className="px-4">
        <Skeleton className="h-8 w-8 rounded" />
      </td>
    </tr>
  );
}

export function JobseekersTable({
  jobseekers,
  selectedIds,
  onSelectionChange,
  onJobseekerClick,
  sortField,
  sortDir,
  onSort,
  isLoading = false,
  onMakeAdmin,
  onActivate,
  onSuspend,
  onDelete,
  page,
  limit,
  total,
  totalPages,
  onPageChange,
  onLimitChange,
}: JobseekersTableProps) {
  const allSelected = jobseekers.length > 0 && selectedIds.size === jobseekers.length;

  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    variant: ConfirmModalVariant;
    target: Jobseeker | null;
  }>({ open: false, variant: "delete", target: null });

  const openConfirm = (variant: ConfirmModalVariant, js: Jobseeker) =>
    setConfirmModal({ open: true, variant, target: js });

  const handleConfirm = () => {
    const { variant, target } = confirmModal;
    if (target) {
      if (variant === "suspend") onSuspend?.(target);
      else if (variant === "delete") onDelete?.(target);
      // "flag" has no backing model yet — no-op beyond closing.
    }
    setConfirmModal((s) => ({ ...s, open: false }));
  };

  const toggleAll = () => {
    if (allSelected) onSelectionChange(new Set());
    else onSelectionChange(new Set(jobseekers.map((j) => j.id)));
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  };

  const SortButton = ({ field, label }: { field: string; label: string }) => (
    <button
      className="flex items-center gap-1 hover:text-foreground"
      onClick={() => onSort(field)}
    >
      {label}
      <ArrowUpDown className={cn("h-3 w-3", sortField === field && "text-foreground")} />
    </button>
  );

  return (
    <div className="rounded-2xl bg-card shadow-card border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="w-12 px-4 py-3">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
              <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground md:table-cell">
                Email
              </th>
              <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground lg:table-cell">
                Location
              </th>
              <th className="hidden px-4 py-3 font-medium text-muted-foreground lg:table-cell">
                <SortButton field="applications" label="Apps" />
              </th>
              <th className="hidden px-4 py-3 font-medium text-muted-foreground xl:table-cell">
                <SortButton field="savedJobs" label="Saved" />
              </th>
              <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground xl:table-cell">
                Profile
              </th>
              <th className="hidden px-4 py-3 font-medium text-muted-foreground lg:table-cell">
                <SortButton field="lastActive" label="Last Active" />
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground xl:table-cell">
                Risk
              </th>
              <th className="w-12 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading && jobseekers.length === 0 ? (
              // Render skeleton rows while loading
              Array.from({ length: 5 }).map((_, index) => (
                <SkeletonTableRow key={`skeleton-${index}`} />
              ))
            ) : (
              jobseekers.map((js) => (
              <tr
                key={js.id}
                className={cn(
                  "h-16 border-b border-border/50 transition-colors hover:bg-secondary/40",
                  selectedIds.has(js.id) && "bg-secondary/30"
                )}
              >
                <td className="px-4">
                  <Checkbox
                    checked={selectedIds.has(js.id)}
                    onCheckedChange={() => toggleOne(js.id)}
                  />
                </td>
                {/* Name + avatar */}
                <td className="px-4">
                  <button
                    className="flex items-center gap-2.5 text-left"
                    onClick={() => onJobseekerClick(js)}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold text-foreground overflow-hidden">
                      {js.avatar.startsWith('http') ? (
                        <img
                          src={js.avatar}
                          alt={`${js.name} avatar`}
                          className="h-full w-full object-cover rounded-full"
                          onError={(e) => {
                            // Fallback to initials if image fails to load
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                              parent.textContent = (js.name || js.email).substring(0, 2).toUpperCase();
                            }
                          }}
                        />
                      ) : (
                        js.avatar
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-foreground hover:text-accent transition-colors leading-tight">
                        {js.name}
                      </p>
                      {js.isPremium && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-status-pending">
                          <Star className="h-2.5 w-2.5" /> Premium
                        </span>
                      )}
                    </div>
                  </button>
                </td>
                {/* Email */}
                <td className="hidden px-4 text-muted-foreground md:table-cell">{js.email}</td>
                {/* Location */}
                <td className="hidden px-4 text-muted-foreground lg:table-cell">{js.location}</td>
                {/* Apps */}
                <td className="hidden px-4 text-center font-medium text-foreground lg:table-cell">
                  {js.applications}
                </td>
                {/* Saved */}
                <td className="hidden px-4 text-center text-muted-foreground xl:table-cell">
                  {js.savedJobs}
                </td>
                {/* Profile completion */}
                <td className="hidden px-4 xl:table-cell">
                  <div className="w-24 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{Math.round(js.profileCompletion)}%</span>
                    </div>
                    <Progress value={js.profileCompletion} className="h-1.5" />
                  </div>
                </td>
                {/* Last Active */}
                <td className="hidden px-4 text-center text-muted-foreground lg:table-cell">
                  {new Date(js.lastActive).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </td>
                {/* Status */}
                <td className="px-4">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
                      statusStyles[js.status]
                    )}
                  >
                    {js.status}
                  </span>
                </td>
                {/* Risk */}
                <td className="hidden px-4 xl:table-cell">
                  <div className="flex items-center gap-1.5">
                    <span className={cn("h-2 w-2 rounded-full", riskDot[js.risk])} />
                    <span className="text-xs text-muted-foreground">{js.risk}</span>
                    <span className="text-xs text-muted-foreground/60">({js.riskScore})</span>
                  </div>
                </td>
                {/* Actions */}
                <td className="px-4">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                     <DropdownMenuContent align="end" className="bg-popover">
                      <DropdownMenuItem onClick={() => onJobseekerClick(js)}>
                        View Profile
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toast.info("Edit mode coming soon")}>
                        Edit
                      </DropdownMenuItem>
                      {onMakeAdmin && (
                        <DropdownMenuItem onClick={() => onMakeAdmin(js)}>
                          <ShieldCheck className="mr-2 h-3.5 w-3.5 text-status-active" />
                          Make admin
                        </DropdownMenuItem>
                      )}
                      {js.status === "Suspended" && (
                        <DropdownMenuItem onClick={() => onActivate?.(js)}>
                          <CheckCircle2 className="mr-2 h-3.5 w-3.5 text-status-active" />
                          Activate
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => openConfirm("flag", js)}>
                        <Flag className="mr-2 h-3.5 w-3.5 text-status-flagged" />
                        Flag
                      </DropdownMenuItem>
                      {js.status !== "Suspended" && (
                        <DropdownMenuItem onClick={() => openConfirm("suspend", js)}>
                          <ShieldOff className="mr-2 h-3.5 w-3.5 text-status-pending" />
                          Suspend
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem className="text-destructive" onClick={() => openConfirm("delete", js)}>
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                        Delete
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
        label="jobseekers"
      />

      <ConfirmModal
        open={confirmModal.open}
        variant={confirmModal.variant}
        targetName={confirmModal.target?.name ?? ""}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmModal((s) => ({ ...s, open: false }))}
      />
    </div>
  );
}
