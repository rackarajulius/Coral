import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, Info, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Insight } from "@/lib/api/employerAnalytics";

const KIND = {
  attention: { icon: AlertTriangle, tone: "text-rose-600 bg-rose-500/10 dark:text-rose-400" },
  action: { icon: Wrench, tone: "text-orange-600 bg-orange-500/10 dark:text-orange-400" },
  observation: { icon: Info, tone: "text-slate-600 bg-slate-500/10 dark:text-slate-300" },
} as const;

/**
 * One insight.
 *
 * Shows the evidence the rule fired on so the claim can be checked, and no
 * confidence score — these are database counts, not predictions. The previous
 * version displayed "Confidence 92%" beside invented findings, which is the
 * detail that made them persuasive.
 */
const InsightCard = ({ insight }: { insight: Insight }) => {
  const { icon: Icon, tone } = KIND[insight.kind] ?? KIND.observation;

  return (
    <div className="rounded-lg border border-border p-3 transition-colors hover:bg-secondary/40">
      <div className="flex items-start gap-2.5">
        <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md", tone)}>
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{insight.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{insight.body}</p>
          <p className="mt-2 text-[11px] font-medium tabular-nums text-foreground/70">
            {insight.evidence}
          </p>
          {insight.link && insight.linkLabel && (
            <Link
              to={insight.link}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
            >
              {insight.linkLabel}
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default InsightCard;
