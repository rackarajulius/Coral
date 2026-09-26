import { ApplicationStatus, RiskLevel } from "@/data/admin/applications/applications";
import { cn } from "@/lib/utils";


const statusStyles: Record<ApplicationStatus, string> = {
  Submitted:
    "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400",

  "Under Review":
    "bg-blue-500/10 text-blue-600 border border-blue-500/20 dark:bg-blue-500/20 dark:text-blue-400",

  Shortlisted:
    "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400",

  Interview:
    "bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 dark:bg-indigo-500/20 dark:text-indigo-400",

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

const riskStyles: Record<RiskLevel, { dot: string; text: string }> = {
  Low: {
    dot: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  Medium: {
    dot: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
  },
  High: {
    dot: "bg-rose-500",
    text: "text-rose-600 dark:text-rose-400",
  },
};


export function RiskBadge({ level, reason }: { level: RiskLevel; reason: string }) {
  const style = riskStyles[level];
  return (
    <div className="flex items-center gap-1.5 group relative">
      <span className={cn("h-2 w-2 rounded-full", style.dot)} />
      <span className={cn("text-xs font-medium", style.text)}>{level}</span>
      <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-50">
        <div className="rounded-lg bg-popover border border-border px-3 py-2 text-xs shadow-elevated max-w-[200px]">
          {reason}
        </div>
      </div>
    </div>
  );
}

export function ScreeningScoreBar({ score }: { score: number }) {
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
