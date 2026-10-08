import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, UsersRound, TrendingUp, Eye } from "lucide-react";
import KpiCard, { KpiCardProps } from "./KpiCard";
import SectionHeader from "@/components/employer-dashboard/overview/SectionHeader";
import { useEmployerAnalyticsStore } from "@/stores/employerAnalyticsStore";
import { getMyHiringStats } from "@/lib/api/employerCompany";

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

  /**
   * The response-rate tile read `value: "92%"` and `delta: "+4.2%"` — both
   * literals, on a dashboard where every tile beside them is counted. It now
   * uses the figure candidates are shown on the public company page, from the
   * same endpoint, and goes quiet when that endpoint says there is too little
   * to report rather than inventing a number to fill the card.
   */
  const { data: hiring } = useQuery({
    queryKey: ["my-hiring-stats"],
    queryFn: getMyHiringStats,
    retry: false,
    staleTime: 30 * 60_000,
  });
  const responseRate =
    hiring?.available && hiring.responseRate !== null ? hiring.responseRate : null;

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
      to: "/employers/jobs",
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
      to: "/employers/candidates",
    },
    {
      icon: TrendingUp,
      label: "Response Rate",
      // An em dash, never a number, until there is enough to report one.
      value: responseRate === null ? "—" : `${responseRate}%`,
      unit:
        responseRate === null
          ? "not enough applications yet"
          : `of ${hiring!.sampleSize} application${hiring!.sampleSize === 1 ? "" : "s"}`,
      delta:
        responseRate === null
          ? "Measured once candidates start applying"
          : `${hiring!.windowDays}-day window`,
      trend: "neutral",
      accent: "card",
      iconColor: "text-emerald-600",
      ctaLabel: "View analytics",
      to: "/employers/analytics",
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
      to: "/employers/analytics",
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
