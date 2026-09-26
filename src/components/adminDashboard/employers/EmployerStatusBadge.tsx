import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, Ban, AlertTriangle } from "lucide-react";

const statusConfig = {
  verified: {
    label: "Verified",
    icon: CheckCircle2,
    className:
      "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400",
  },
  pending: {
    label: "Pending",
    icon: Clock,
    className:
      "bg-amber-500/10 text-amber-600 border border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400",
  },
  suspended: {
    label: "Suspended",
    icon: Clock,
    className:
      "bg-amber-500/10 text-amber-600 border border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400",
  },
  banned: {
    label: "Banned",
    icon: Ban,
    className:
      "bg-rose-500/10 text-rose-600 border border-rose-500/20 dark:bg-rose-500/20 dark:text-rose-400",
  },
  flagged: {
    label: "Flagged",
    icon: AlertTriangle,
    className:
      "bg-amber-500/10 text-amber-600 border border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400",
  },
};

export function EmployerStatusBadge({ status }: { status: keyof typeof statusConfig }) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        config.className
      )}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}
