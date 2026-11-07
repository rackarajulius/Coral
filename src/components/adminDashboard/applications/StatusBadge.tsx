import { ApplicationStatus } from "@/data/admin/applications/applications";
import { cn } from "@/lib/utils";


const statusStyles: Record<ApplicationStatus, string> = {
  Applied:
    "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400",

  Screening:
    "bg-blue-500/10 text-blue-600 border border-blue-500/20 dark:bg-blue-500/20 dark:text-blue-400",

  Interview:
    "bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 dark:bg-indigo-500/20 dark:text-indigo-400",

  Offer:
    "bg-violet-500/10 text-violet-600 border border-violet-500/20 dark:bg-violet-500/20 dark:text-violet-400",

  Hired:
    "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400",

  Rejected:
    "bg-rose-500/10 text-rose-600 border border-rose-500/20 dark:bg-rose-500/20 dark:text-rose-400",

  Withdrawn:
    "bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400",

  Flagged:
    "bg-amber-500/10 text-amber-600 border border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400",
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", statusStyles[status])}>
      {status}
    </span>
  );
}

/** How complete the applicant's profile is, 0–100. Not a screening result. */
export function ProfileCompletionBar({ score }: { score: number }) {
  const color =
  score >= 80
    ? "bg-emerald-500"
    : score >= 60
    ? "bg-amber-500"
    : "bg-rose-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-medium text-muted-foreground">{score}%</span>
    </div>
  );
}
