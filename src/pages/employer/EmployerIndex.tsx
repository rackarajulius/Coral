
import Hero from "@/components/landing/Hero";
import FeatureGrid from "@/components/landing/FeatureGrid";
import SearchTeaser from "@/components/landing/SearchTeaser";
import FreeTier from "@/components/landing/FreeTier";
import Benefits from "@/components/landing/Benefits";
import FinalCTA from "@/components/landing/FinalCTA";
import Footer from "@/components/landing/Footer";
import Testimonials from "@/components/landing/Testimonials";
import Navbar from "@/components/navbar/Navbar";
import ScrollToTop from "@/components/ui/ScrollToTop";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
        <Hero />
        <FeatureGrid />
        <Benefits />
        <SearchTeaser />
        <FreeTier />
        <Testimonials />
        <FinalCTA />
         <ScrollToTop />
      <Footer />
    </div>
  );
};

export default Index;
