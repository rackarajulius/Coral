import Navbar from "@/components/navbar/Navbar";
import Footer from "@/components/landing/Footer";
import ScrollToTop from "@/components/ui/ScrollToTop";
import Hero from "@/components/find-talent-landing/Hero";
import HowItWorks from "@/components/find-talent-landing/HowItWorks";
import WhyInvest from "@/components/find-talent-landing/WhyInvest";
import SocialProof from "@/components/find-talent-landing/SocialProof";
import FinalCTA from "@/components/find-talent-landing/FinalCTA";

const FindTalent = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <HowItWorks />
        <WhyInvest />
        <SocialProof />
        <FinalCTA />
      </main>
      <ScrollToTop />
      <Footer />
    </div>
  );
};

export default FindTalent;
