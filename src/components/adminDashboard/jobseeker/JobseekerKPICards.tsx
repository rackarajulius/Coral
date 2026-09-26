export interface JobseekerMetrics {
  totalJobseekers: number;
  newSignups7d: number;
  active30d: number;
  suspended: number;
  flagged: number;
  /** Paid or complimentary Premium. */
  premiumUsers: number;
}

interface JobseekerKPICardsProps {
  metrics?: JobseekerMetrics;
}

/**
 * Current counts only. There are no trend figures: nothing records these
 * numbers over time, so any "+x%" would be invented.
 */
export function JobseekerKPICards({ metrics }: JobseekerKPICardsProps) {
  // A dash while loading, rather than a zero that looks like a real count.
  const show = (n: number | undefined) => (metrics && n !== undefined ? n.toLocaleString() : "—");

  const kpis = [
    { label: "Total Jobseekers", value: show(metrics?.totalJobseekers) },
    { label: "New Signups (7d)", value: show(metrics?.newSignups7d) },
    { label: "Active (30d)", value: show(metrics?.active30d) },
    { label: "Suspended", value: show(metrics?.suspended) },
    { label: "Flagged", value: show(metrics?.flagged) },
    { label: "Premium Users", value: show(metrics?.premiumUsers) },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
      {kpis.map((kpi) => (
        <div
          key={kpi.label}
          className="group rounded-xl border border-border bg-card p-5 hover:shadow-md transition-all duration-300"
        >
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase text-muted-foreground tracking-wide">{kpi.label}</p>
            <p className="text-[30px] font-semibold leading-none tracking-tight text-foreground animate-count-up">
              {kpi.value}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
