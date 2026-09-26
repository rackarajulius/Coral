import { useEffect } from "react";
import HeroBanner from "@/components/employer-dashboard/overview/HeroBanner";
import KpiGrid from "@/components/employer-dashboard/overview/KpiGrid";
import QuickActionsGrid from "@/components/employer-dashboard/overview/QuickActionsGrid";
import ActivityFeed from "@/components/employer-dashboard/overview/ActivityFeed";
import NextBestActions from "@/components/employer-dashboard/overview/NextBestActions";
import FinishSetupCard from "@/components/employer-dashboard/overview/FinishSetupCard";
import UpgradeBanner from "@/components/employer-dashboard/overview/UpgradeBanner";
import { employer } from "@/data/employer/overview/data";
import { useAuth } from "@/contexts/AuthContext";
import { useJobsStore } from "@/stores/jobsStore";
import { useEmployerCompanyStore } from "@/stores/employerCompanyStore";

const Dashboard = () => {
  const { user } = useAuth();
  const { jobs, fetchJobs } = useJobsStore();
  const { company, fetchCompany } = useEmployerCompanyStore();

  useEffect(() => {
    fetchJobs().catch(() => {});
    fetchCompany().catch(() => {});
  }, [fetchJobs, fetchCompany]);

  const hasBranding = !!company && company.companyName !== "New Company";
  const companyName = hasBranding ? company.companyName : employer.companyName;
  const tagline = hasBranding ? company.tagline : null;
  const bannerUrl = hasBranding ? company.companyBanner : null;
  const userName = user?.firstName || user?.displayName?.split(" ")[0] || employer.user;

  const activeJobsCount = jobs.filter((j) => j.status === "Open").length;
  const totalApplicants = jobs.reduce((sum, j) => sum + j.applicants, 0);

  return (
    <div className="bg-white dark:bg-background">
        <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6 lg:p-8">
          <HeroBanner
            companyName={companyName}
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
