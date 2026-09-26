import { useEffect } from "react";
import { Briefcase, UsersRound, TrendingUp, Eye } from "lucide-react";
import KpiCard, { KpiCardProps } from "./KpiCard";
import SectionHeader from "@/components/employer-dashboard/overview/SectionHeader";
import { useEmployerAnalyticsStore } from "@/stores/employerAnalyticsStore";

function weekOverWeekDelta(pct: number): Pick<KpiCardProps, "delta" | "trend"> {
  if (pct > 0) return { delta: `+${pct}%`, trend: "up" };
  if (pct < 0) return { delta: `${pct}%`, trend: "down" };
  return { delta: "No change this week", trend: "neutral" };
}

const KpiGrid = () => {
  const { analytics, fetchAnalytics } = useEmployerAnalyticsStore();

  useEffect(() => {
    fetchAnalytics().catch(() => {});
  }, [fetchAnalytics]);

  const counters = analytics?.counters;
  const viewsPerApplication = analytics?.conversion.viewsPerApplication ?? 0;
  const applicantsDelta = analytics
    ? weekOverWeekDelta(analytics.trends.applicantsWeekOverWeekPct)
    : { delta: "—", trend: "neutral" as const };
  const activeJobsDelta: Pick<KpiCardProps, "delta" | "trend"> = counters?.newActiveJobsThisWeek
    ? { delta: `+${counters.newActiveJobsThisWeek} this week`, trend: "up" }
    : { delta: "No change this week", trend: "neutral" };

  const kpis: KpiCardProps[] = [
    {
      icon: Briefcase,
      label: "Active Jobs",
      value: String(counters?.activeJobs ?? 0),
      unit: "open roles",
      ...activeJobsDelta,
      accent: "from-indigo-500/15 to-indigo-500/0",
      iconColor: "text-indigo-600",
      ctaLabel: "View jobs",
      to: "/employer/jobs",
    },
    {
      icon: UsersRound,
      label: "New Applicants",
      value: String(counters?.applicationsToday ?? 0),
      unit: "today",
      ...applicantsDelta,
      accent: "from-rose-500/15 to-rose-500/0",
      iconColor: "text-rose-600",
      ctaLabel: "See candidates",
      to: "/employer/candidates",
    },
    {
      icon: TrendingUp,
      label: "Response Rate",
      value: "92%",
      unit: "last 7 days",
      delta: "+4.2%",
      trend: "up",
      accent: "card",
      iconColor: "text-emerald-600",
      ctaLabel: "View analytics",
      to: "/employer/analytics&reports",
    },
    {
      icon: Eye,
      label: "Views → Applications",
      value: `${viewsPerApplication.toFixed(1)}x`,
      unit: "ratio",
      delta: "Trend coming soon",
      trend: "neutral",
      accent: "from-amber-500/15 to-amber-500/0",
      iconColor: "text-amber-600",
      ctaLabel: "View analytics",
      to: "/employer/analytics&reports",
    },
  ];

  return (
    <section aria-label="Performance snapshot">
      <SectionHeader title="Performance snapshot" subtitle="A fast read on what matters today." />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {kpis.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </div>
    </section>
  );
};

export default KpiGrid;
