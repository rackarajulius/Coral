import { Briefcase, CheckCircle2, Clock, Flag, XCircle, Archive, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
}

interface KpiRowProps {
  metrics?: any;
}

export function KpiCard({ label, value, change, changeType = "neutral", icon: Icon }: KpiCardProps) {
  return (
    <div className="bg-card rounded-[14px] border border-border shadow-card p-5 flex flex-col gap-2 
    hover:shadow-md transition-all duration-300 relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div>
           <p className="text-sm text-muted-foreground  uppercase">{label}</p>
          <p className="text-[30px] font-semibold leading-tight text-card-foreground animate-count-up mt-1">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
         
        </div>

      </div>
      {change && (
        <p
          className={cn(
            "text-xs font-medium",
            changeType === "positive" && "text-status-active",
            changeType === "negative" && "text-status-rejected",
            changeType === "neutral" && "text-muted-foreground"
          )}
        >
          {change}
        </p>
      )}
    </div>
  );
}

export function KpiRow({ metrics }: KpiRowProps) {
  const kpis: KpiCardProps[] = (metrics?.kpis || [
    { label: "Total Jobs", value: "0", changeType: "neutral" as const, icon: Briefcase },
    { label: "Active Jobs", value: "0", changeType: "neutral" as const, icon: CheckCircle2 },
    { label: "Pending Approval", value: "0", changeType: "neutral" as const, icon: Clock },
    { label: "Flagged", value: "0", changeType: "neutral" as const, icon: Flag },
    { label: "Expired", value: "0", changeType: "neutral" as const, icon: Archive },
    { label: "Rejected", value: "0", changeType: "neutral" as const, icon: XCircle },
  ]).map((kpi: any) => ({
    label: kpi.label,
    value: kpi.value,
    change: kpi.change ? `${kpi.change > 0 ? '+' : ''}${kpi.change}%` : undefined,
    changeType: (kpi.change > 0 ? "positive" : kpi.change < 0 ? "negative" : "neutral") as "positive" | "negative" | "neutral",
    icon: Briefcase, // Default icon, could be mapped based on label
  }));

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
      {kpis.map((kpi) => (
        <KpiCard key={kpi.label} {...kpi} />
      ))}
    </div>
  );
}
