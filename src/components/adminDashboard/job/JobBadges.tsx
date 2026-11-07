import { cn } from "@/lib/utils";
import { Job } from "@/data/admin/job/jobs";

type StatusType = Job["status"];

const neutralStatus =
  "bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400";

// Lifecycle states, not verdicts — nothing here is red, because none of them
// says the job did anything wrong.
const statusStyles: Record<StatusType, string> = {
  Active:
    "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400",

  Expired:
    "bg-amber-500/10 text-amber-600 border border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400",

  Draft: neutralStatus,

  Paused:
    "bg-blue-500/10 text-blue-600 border border-blue-500/20 dark:bg-blue-500/20 dark:text-blue-400",

  Closed: neutralStatus,

  Archived: neutralStatus,
};

export function StatusBadge({ status }: { status: StatusType }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", statusStyles[status] ?? neutralStatus)}>
      {status}
    </span>
  );
}

export function TypeBadge({ type }: { type: Job["type"] }) {
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-secondary text-secondary-foreground">
      {type}
    </span>
  );
}
