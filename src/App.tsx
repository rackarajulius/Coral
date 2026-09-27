import React, { useEffect, useState } from "react";
import { onAfterSignOut } from "./lib/signOutHooks";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet, Navigate } from "react-router-dom";
import ScrollToTopOnNavigate from "./components/ScrollToTopOnNavigate";
import EmployerLayout from "./components/employer-dashboard/Layout/EmployerLayout";
import { EmployerAuthGate } from "./components/employer-dashboard/Layout/EmployerAuthGate";
import Index from "./pages/Index";
import FindJobs from "./pages/FindJobs";
import NotFound from "./pages/NotFound";
import Unsubscribe from "./pages/Unsubscribe";
import { MantineProvider } from "@mantine/core";
import { ThemeProvider, useTheme } from "next-themes";
import "@mantine/core/styles.css";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import Contact from "./pages/Contact";
import Profile from "./pages/jobSeeker/Profile";
import Settings from "./pages/jobSeeker/Settings";
import CoachHome from "./pages/InterviewCoach/CoachHome";
import InterviewSetup from "./pages/InterviewCoach/InterviewSetup";
import InterviewSession from "./pages/InterviewCoach/InterviewSession";
import InterviewReport from "./pages/InterviewCoach/InterviewReport";
import InterviewHistory from "./pages/InterviewCoach/InterviewHistory";
import JobAlerts from "./pages/jobSeeker/JobAlerts";
import ResumeMatcher from "./pages/jobSeeker/ResumeMatcher";
import Premium from "./pages/jobSeeker/Premium";
import SalaryTransparencyHub from "./pages/jobSeeker/SalaryTransparencyHub";
import SavedJobs from "./pages/jobSeeker/SavedJobs";
import VideoProfilePage from "./pages/jobSeeker/VideoProfilePage";
import JobPreferences from "./pages/jobSeeker/JobPreferences";
import Activity from "./pages/jobSeeker/Activity";
import JobSeekerMessages from "./pages/jobSeeker/JobSeekerMessages";
import OutreachMessagePage from "./pages/jobSeeker/OutreachMessage";
import SeekerNotifications from "./pages/jobSeeker/Notifications";
import PublicProfile from "./pages/jobSeeker/PublicProfile";
import AiScreen from "./pages/jobSeeker/AiScreen";
import GoogleOAuthCallback from "./pages/oauth/GoogleOAuthCallback";
import InterviewRoom from "./pages/interview/InterviewRoom";
import Availability from "./pages/employer/dashboard/Availability";
import BookingPage from "./pages/booking/BookingPage";
import Connections from "./pages/jobSeeker/Connections";
import Onboarding from "./pages/onboarding/Onboarding";
import OnboardingGate from "./components/OnboardingGate";
import EmployerAreaGate from "./components/EmployerAreaGate";
import AuthRedirect from "./pages/AuthRedirect";
import AuthCallback from "./pages/AuthCallback";
import { ProfileProvider } from "./contexts/ProfileContext";
import { AuthProvider } from "./contexts/AuthContext";
import { AuthModalProvider } from "./contexts/AuthModalContext";
import GoogleOneTap from "./components/GoogleOneTap";
import UpgradeDialog from "./components/premium/UpgradeDialog";
import { AdminProvider } from "./contexts/AdminContext";
import CommunityPage from "./pages/community/page";
import CommunityModerationPage from "./pages/community/moderation";
import TidePage from "./pages/community/TidePage";
import Companies from "./pages/Companies";
import CompanyProfile from "./pages/CompanyProfile";
import EmployerCompanyProfile from "./pages/employer/dashboard/CompanyProfile";
import EmployerAnalytics from "./pages/employer/dashboard/Analytics";
import AdvancedAnalytics from "./pages/employer/Analytics";
import FindTalent from "./pages/FindTalent";
import EmployerIndex from "./pages/employer/EmployerIndex";
import EmployerProfile from "./pages/employer/EmployerProfile";
import EmployerDashboard from "./pages/employer/dashboard/EmployerDashboard";
import EmployerOnboarding from "./pages/employer/dashboard/EmployerOnboarding";
import JoinCompany from "./pages/employer/JoinCompany";
import Automations from "./pages/employer/dashboard/Automations";
import Integrations from "./pages/employer/dashboard/Integrations";
import AIHiring from "./pages/employer/AIHiring";
import EmployerFeatures from "./pages/employer/EmployerFeatures";
import EmployerBranding from "./pages/employer/EmployerBranding";
import Performance from "./pages/employer/Performance";
import EmployerContact from "./pages/employer/Contact";
import EmployerPrivacyPolicy from "./pages/employer/PrivacyPolicy";
import EmployerTermsOfService from "./pages/employer/TermsOfService";
import EmployerMessages from "./pages/employer/dashboard/EmployerMessages";
import EmployerJobs from "./pages/employer/dashboard/EmployerJobs";
import ScreeningBoard from "./pages/employer/dashboard/ScreeningBoard";
import Candidates from "./pages/employer/dashboard/Candidates";
import PostJob from "./pages/employer/dashboard/PostJob";
import EditJob from "./pages/employer/dashboard/EditJob";
import Reviews from "./pages/employer/dashboard/Reviews";
import HiringAssistant from "./pages/employer/dashboard/HiringAssistant";
import Pricing from "./pages/employer/dashboard/Pricing";
import Billing from "./pages/employer/dashboard/Billing";
import EmployerNotifications from "./pages/employer/dashboard/EmployerNotifications";
import SettingsPage from "./pages/employer/dashboard/Settings";
import TeamPage from "./pages/employer/dashboard/Team";
import ResetPassword from "./pages/ResetPassword";
import { AppLayout } from "./components/adminDashboard/layout/AppLayout.tsx";
import Overview from "./pages/admin/Overview.tsx";
import JobSeekers from "./pages/admin/JobSeekers.tsx";
import AddJobseekerPage from "./pages/admin/AddJobseekerPage.tsx";
import Employers from "./pages/admin/Employers.tsx";
import AddEmployerPage from "./pages/admin/AddEmployer.tsx";
import Jobs from "./pages/admin/Jobs.tsx";
import CreateJob from "./pages/admin/CreateJob.tsx";
import ApplicationsPage from "./pages/admin/ApplicationsPage.tsx";
import Verifications from "./pages/admin/Verifications.tsx";
import ReviewModeration from "./pages/admin/ReviewModeration.tsx";
import ReportsPage from "./pages/admin/ReportsPage.tsx";
import SystemHealthPage from "./pages/admin/SystemHealth.tsx";
import General from "./pages/admin/settings/General.tsx";
import TaxonomiesPage from "./pages/admin/settings/TaxonomiesPage.tsx";
import SeoBranding from "./pages/admin/settings/SeoBranding.tsx";
import RolesPermissions from "./pages/admin/settings/RolesPermissions.tsx";
import AutomationPage from "./pages/admin/settings/Automation.tsx";
import IntegrationsPage from "./pages/admin/settings/integrations.tsx";
import AlertsPage from "./pages/admin/Alerts.tsx";
import AuditLogsPage from "./pages/admin/AuditLogs.tsx";
import EmailTemplates from "./pages/admin/settings/EmailTemplates.tsx";
import IncidentDetailPage from "./pages/admin/IncidentDetail.tsx";








const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000, // 2 minutes
      gcTime: 30 * 60 * 1000, // 30 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});

/**
 * Forget every response once a session ends.
 *
 * With a 2-minute stale time and a 30-minute cache, the next person to sign in
 * on this tab would otherwise be shown the last person's data until each query
 * happened to refetch — their profile views, who viewed them, and a signed
 * download link to their resume among it. Cleared after the session is gone,
 * not before, so nothing still mounted refetches with a token that is about to
 * stop working.
 */
onAfterSignOut(() => queryClient.clear());

const EmployerRoute = () => (
  <EmployerAuthGate>
    <EmployerLayout><Outlet /></EmployerLayout>
  </EmployerAuthGate>
);

/**
 * One auth stack for the whole app. A single AuthProvider means every route
 * (public, job-seeker, employer, admin) shares the same session — no more
 * per-path provider branching or nested providers. AdminProvider is scoped to
 * the /admin routes (see below) so its metrics fetch fires on entry.
 */
const AppProviders = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>
    <ProfileProvider>
      <TooltipProvider>
        {children}
      </TooltipProvider>
    </ProfileProvider>
  </AuthProvider>
);

/** Keeps Mantine's color scheme in lockstep with next-themes (single source of truth). */
const ThemedMantineProvider = ({ children }: { children: React.ReactNode }) => {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const colorScheme = mounted && resolvedTheme === "dark" ? "dark" : "light";
  return <MantineProvider forceColorScheme={colorScheme}>{children}</MantineProvider>;
};

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
  <ThemedMantineProvider>
  <QueryClientProvider client={queryClient}>
    <AppProviders>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScrollToTopOnNavigate />
        <AuthModalProvider>
        <GoogleOneTap />
        {/* One upgrade prompt for the whole app; features open it on a refusal. */}
        <UpgradeDialog />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/jobs" element={<FindJobs />} />
           <Route path="/privacy-policy" element={<PrivacyPolicy />} />
           <Route path="/terms-of-service" element={<TermsOfService/>} />
           <Route path="/community" element={<CommunityPage />} />
           <Route path="/community/moderation" element={<CommunityModerationPage />} />
           {/* Same page, same layout — the slug only changes the middle
               column, so the sidebar never unmounts. */}
           <Route path="/community/search" element={<CommunityPage />} />
           {/* Spaces are found through search; the bare path goes there. */}
           <Route path="/community/spaces" element={<Navigate to="/community/search?tab=spaces" replace />} />
           <Route path="/community/spaces/:slug" element={<CommunityPage />} />
           {/* A single post, so a notification has somewhere to land and a
               post can be shared. Same shell — only the middle column changes. */}
           <Route path="/community/posts/:postId" element={<CommunityPage />} />
           {/* A tide on its own — where a card, a notification or a calendar
               file lands. Its own page rather than the community shell: it is
               shared outside the community too. */}
           {/* The listing lives in the community shell; a single tide has its
               own page, because it is shared outside the community too. */}
           <Route path="/community/tides" element={<CommunityPage />} />
           <Route path="/community/tides/:tideId" element={<TidePage />} />
           <Route path="/companies" element={<Companies/>} />
            <Route path="/company" element={<CompanyProfile/>} />
            <Route path="/company-profile" element={<CompanyProfile/>} />
            <Route path="/company-profile/:id" element={<CompanyProfile/>} />
            <Route path="/find-talent" element={<FindTalent />} />



            <Route path="/contact-us" element={<Contact/>} />
            <Route path="/login" element={<AuthRedirect view="social" />} />
            <Route path="/signup" element={<AuthRedirect view="signup" />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />
            <Route path = "/onboarding" element={<Onboarding/>} />
            <Route path = "/profile/:id" element={<PublicProfile/>} />
            <Route path="/ai-screen/:id" element={<AiScreen/>} />
            {/* Accessible to any authenticated participant (both roles); access enforced by the API */}
            <Route path="/interview/:id/room" element={<InterviewRoom />} />
            <Route path="/book/:employerId" element={<BookingPage />} />
            <Route path="/oauth/google" element={<GoogleOAuthCallback />} />

            {/* Job seeker app routes — funnel new (PENDING_ONBOARDING) users to /onboarding */}
            <Route element={<OnboardingGate/>}>
              <Route path = "/jobseeker/profile" element={<Profile/>} />
              <Route path = "/jobseeker/preferences" element={<JobPreferences/>} />
              <Route path = "/activity" element={<Activity/>} />
              <Route path = "/jobseeker/messages" element={<JobSeekerMessages/>} />
              <Route path = "/notifications" element={<SeekerNotifications/>} />
              {/* An approach from a company, and where to answer it. */}
              <Route path = "/outreach/:id" element={<OutreachMessagePage/>} />
              <Route path = "/connections" element={<Connections/>} />
              <Route path = "/jobseeker/settings" element={<Settings/>} />
              <Route path = "/video-profile" element={<VideoProfilePage/>} />
              <Route path = "/saved-jobs" element={<SavedJobs/>} />
              <Route path = "/salary-transparency-hub" element={<SalaryTransparencyHub/>} />
              <Route path = "/resume-matcher" element={<ResumeMatcher/>} />
              <Route path = "/premium" element={<Premium/>} />
              <Route path = "/job-alerts" element={<JobAlerts/>} />
              {/* AI Interview Coach — standalone (no job-seeker sidebar) */}
              <Route path = "/interview-prep" element={<CoachHome/>} />
              <Route path = "/interview-prep/setup" element={<InterviewSetup/>} />
              <Route path = "/interview-prep/session/:id" element={<InterviewSession/>} />
              <Route path = "/interview-prep/report/:id" element={<InterviewReport/>} />
              <Route path = "/interview-prep/history" element={<InterviewHistory/>} />
            </Route>

{/* Employer Routes — persistent layout, no remount on navigation */}
            {/* Team invites stay outside the employer-side gate: the page names the
                company and explains a wrong-account problem itself. */}
            <Route path="/employers/join" element={<JoinCompany />} />
            {/* The whole employer side. Signed-in job seekers are sent home. */}
            <Route element={<EmployerAreaGate />}>
             <Route path="/employer" element={<EmployerProfile />} />
             <Route path="/employers" element={<EmployerIndex />} />
            <Route element={<EmployerRoute />}>
            <Route path="/employers/onboarding" element={<EmployerOnboarding />} />
            <Route path="/employers/dashboard" element={<EmployerDashboard />} />
            <Route path="/employers/jobs" element={<EmployerJobs />} />
            <Route path="/employers/jobs/post" element={<PostJob />} />
            <Route path="/employers/jobs/:id/edit" element={<EditJob />} />
            <Route path="/employers/candidates" element={<Candidates />} />
            <Route path="/employers/jobs/:jobId/screening" element={<ScreeningBoard />} />
            <Route path="/employers/availability" element={<Availability />} />
            <Route path="/employers/messages" element={<EmployerMessages />} />
            <Route path="/employers/reviews" element={<Reviews />} />
            <Route path="/employers/hiring" element={<HiringAssistant />} />
            <Route path="/employers/pricing" element={<Pricing />} />
            <Route path="/employers/billing" element={<Billing />} />
            <Route path="/employers/notifications" element={<EmployerNotifications />} />
            <Route path="/employers/settings/*" element={<SettingsPage />} />
            <Route path="/employers/team/*" element={<TeamPage />} />
            <Route path="/employers/company" element={<EmployerCompanyProfile />} />
            <Route path="/employers/automations" element={<Automations />} />
            <Route path="/employers/integrations" element={<Integrations />} />
            <Route path="/employers/analytics" element={<EmployerAnalytics />} />
            </Route>
            <Route path="/employers/ai-hiring" element={<AIHiring />} />
            <Route path="/employers/features" element={<EmployerFeatures />} />
            <Route path="/employers/branding" element={<EmployerBranding />} />
            <Route path="/employers/performance" element={<Performance />} />
            <Route path="/employers/advanced-analytics" element={<AdvancedAnalytics />} />
            <Route path="/employers/contact" element={<EmployerContact />} />
            <Route path="/employers/privacy-policy" element={<EmployerPrivacyPolicy />} />
            <Route path="/employers/terms-of-service" element={<EmployerTermsOfService />} />
            </Route>

            {/* Admin Routes */}
              <Route path="/admin" element={<AdminProvider><AppLayout /></AdminProvider>}>
              <Route path="dashboard" element={<Overview />} />
              <Route path="jobseekers" element={<JobSeekers />} />
              <Route path="jobseekers/add" element={<AddJobseekerPage />} />
              <Route path="employers" element={<Employers />} />
              <Route path="employers/add" element={<AddEmployerPage />} />
              <Route path="jobs" element={<Jobs />} />
              <Route path="jobs/create" element={<CreateJob />} />
              <Route path="applications" element={<ApplicationsPage />} />
              <Route path="verifications" element={<Verifications />} />
              <Route path="reviews" element={<ReviewModeration />} />
              <Route path="reports" element={<ReportsPage />} />
               <Route path="email-templates" element={<EmailTemplates />} />

              <Route path="system-health" element={<SystemHealthPage />} />
              <Route path="system-health/incidents/:id" element={<IncidentDetailPage />}/>
              <Route path="audit-logs" element={<AuditLogsPage />} />
              <Route path="alerts" element={<AlertsPage />} />

              <Route path="general" element={<General/>} />
              <Route path="taxonomies" element={<TaxonomiesPage />} />
              <Route path="seo-branding" element={<SeoBranding />} />
              <Route path="roles" element={<RolesPermissions />} />
              <Route path="automation" element={<AutomationPage />} />
              <Route path="integrations" element={<IntegrationsPage />} />
             </Route>


{/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </AuthModalProvider>
      </BrowserRouter>
    </AppProviders>
  </QueryClientProvider>
  </ThemedMantineProvider>
  </ThemeProvider>
);

export default App;
