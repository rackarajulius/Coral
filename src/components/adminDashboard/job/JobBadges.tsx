import { cn } from "@/lib/utils";
import { Job } from "@/data/admin/job/jobs";

type StatusType = Job["status"];
type RiskType = Job["risk"];

const statusStyles: Record<StatusType, string> = {
  Active:
    "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400",

  Pending:
    "bg-amber-500/10 text-amber-600 border border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400",

  Flagged:
    "bg-orange-500/10 text-orange-600 border border-orange-500/20 dark:bg-orange-500/20 dark:text-orange-400",

  Rejected:
    "bg-rose-500/10 text-rose-600 border border-rose-500/20 dark:bg-rose-500/20 dark:text-rose-400",

  Expired:
    "bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400",

  Suspended:
    "bg-rose-500/10 text-rose-600 border border-rose-500/20 dark:bg-rose-500/20 dark:text-rose-400",
};

const riskStyles: Record<RiskType, string> = {
  Low:
    "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400",

  Medium:
    "bg-amber-500/10 text-amber-600 border border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400",

  High:
    "bg-rose-500/10 text-rose-600 border border-rose-500/20 dark:bg-rose-500/20 dark:text-rose-400",
};

const riskDot: Record<RiskType, string> = {
  Low: "bg-emerald-500",
  Medium: "bg-amber-500",
  High: "bg-rose-500",
};

export function StatusBadge({ status }: { status: StatusType }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", statusStyles[status])}>
      {status}
    </span>
  );
}

export function RiskBadge({ risk }: { risk: RiskType }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", riskStyles[risk])}>
      <span className={cn("h-1.5 w-1.5 rounded-full", riskDot[risk])} />
      {risk}
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
