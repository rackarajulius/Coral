
import ReputationHero from "@/components/employer-dashboard/reviews/ReputationHero";
import KpiGrid from "@/components/employer-dashboard/reviews/KpiGrid";
import Header from "@/components/employer-dashboard/reviews/Header";
import ReputationOverview from "@/components/employer-dashboard/reviews/ReputationOverview";
import ReviewAnalytics from "@/components/employer-dashboard/reviews/ReviewAnalytics";
import SentimentIntelligence from "@/components/employer-dashboard/reviews/SentimentIntelligence";
import TopicInsights from "@/components/employer-dashboard/reviews/Insights";
import ReviewFeed from "@/components/employer-dashboard/reviews/ReviewFeed";
import EmployerReviewList from "@/components/employer-dashboard/reviews/EmployerReviewList";
import ResponseCenter from "@/components/employer-dashboard/reviews/ResponseCenter";
import AIReputation from "@/components/employer-dashboard/reviews/AIReputation";
import Benchmarking from "@/components/employer-dashboard/reviews/Benchmarking";
import Notificattion from "@/components/employer-dashboard/reviews/Notificattion";
import ResponseDialog from "@/components/employer-dashboard/reviews/ResponseDialog";

export default function Reviews() {
 
  return (
    <>
      <div className="mx-auto w-full max-w-[1200px] px-6 py-10 md:px-10 md:py-12">
        {/* ============ HEADER ============ */}
        <header className="space-y-6">
        <Header/>

          {/* Reputation hero */}
        <ReputationHero/>

         {/* KPI grid */}
          <KpiGrid/>
        </header>

        {/* ============ REPUTATION OVERVIEW (Categories) ============ */}
        <ReputationOverview/>

        {/* ============ REVIEW ANALYTICS ============ */}
        <ReviewAnalytics/>

        {/* ============ SENTIMENT INTELLIGENCE ============ */}
       <SentimentIntelligence/>

        {/* ============ TOPIC & CATEGORY INSIGHTS ============ */}
        <TopicInsights/>
        {/* Real reviews, with right of reply. The mock sections around it are
            still in place until they're rebuilt. */}
        <div className="my-10">
          <EmployerReviewList />
        </div>

        {/* ============ REVIEW FEED ============ */}
        <ReviewFeed/>

        {/* ============ RESPONSE CENTER ============ */}
        <ResponseCenter/>

        {/* ============ AI REPUTATION INTELLIGENCE ============ */}
        <AIReputation/>

        {/* ============ BENCHMARKING ============ */}
        <Benchmarking/>

        {/* ============ NOTIFICATIONS ============ */}
        <Notificattion/>
      </div>

      {/* ============ RESPONSE DIALOG ============ */}
      <ResponseDialog/>
    </>
  );
}
