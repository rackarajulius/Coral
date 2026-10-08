import { useEffect } from "react";
import HeroBanner from "@/components/employer-dashboard/overview/HeroBanner";
import KpiGrid from "@/components/employer-dashboard/overview/KpiGrid";
import QuickActionsGrid from "@/components/employer-dashboard/overview/QuickActionsGrid";
import ActivityFeed from "@/components/employer-dashboard/overview/ActivityFeed";
import NextBestActions from "@/components/employer-dashboard/overview/NextBestActions";
import FinishSetupCard from "@/components/employer-dashboard/overview/FinishSetupCard";
import UpgradeBanner from "@/components/employer-dashboard/overview/UpgradeBanner";
import { useAuth } from "@/contexts/AuthContext";
import { personName } from "@/lib/personName";
import { useJobsStore } from "@/stores/jobsStore";
import { useEmployerCompanyStore } from "@/stores/employerCompanyStore";

const Dashboard = () => {
  const { user } = useAuth();
  const { jobs, fetchJobs } = useJobsStore();
  const { identity, loaded, fetchCompany } = useEmployerCompanyStore();

  useEffect(() => {
    fetchJobs().catch(() => {});
    fetchCompany().catch(() => {});
  }, [fetchJobs, fetchCompany]);

  /**
   * What we actually know, or nothing.
   *
   * These fell back to a fixture — "Acme Inc." and "John" — so an employer who
   * had not finished setting up their company was greeted by another company's
   * name and someone else's first name.
   *
   * `identity` is the last known name, read from localStorage before the first
   * paint, so a returning employer sees "Airtel Uganda" immediately rather than
   * "Your dashboard" for a second while the fetch is in flight. It is null on a
   * first visit, and `loaded` is what tells that apart from "no company" — the
   * heading waits rather than asserting either.
   */
  const companyName = identity?.companyName ?? null;
  const tagline = identity?.tagline ?? null;
  const bannerUrl = identity?.companyBanner ?? null;
  const knowsCompany = loaded || identity !== null;
  // First name only, through the one naming rule — which returns nothing
  // rather than the email's local part. See lib/personName.
  const userName = personName(user).split(" ")[0];

  const activeJobsCount = jobs.filter((j) => j.status === "Open").length;
  const totalApplicants = jobs.reduce((sum, j) => sum + j.applicants, 0);

  return (
    <div className="bg-background">
        <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6 lg:p-8">
          <HeroBanner
            companyName={companyName}
            knowsCompany={knowsCompany}
            userName={userName}
            summary={`${activeJobsCount} active job${activeJobsCount === 1 ? "" : "s"} · ${totalApplicants} total applicant${totalApplicants === 1 ? "" : "s"}`}
            bannerUrl={bannerUrl}
            tagline={tagline}
          />
          {/* Above the metrics: verification gates posting, so an employer who
              skipped it needs to see that before anything else. Renders
              nothing once setup is complete. */}
          <FinishSetupCard />
          <KpiGrid />
          <QuickActionsGrid />

          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8">
              <ActivityFeed />
            </div>
            <div className="lg:col-span-4">
              <NextBestActions />
            </div>
          </section>

          <section aria-label="Upgrade to premium">
            <UpgradeBanner />
          </section>
        </div>
    </div>
  );
};

export default Dashboard;
