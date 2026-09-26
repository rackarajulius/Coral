import AnalyticsSection from '@/components/branding-landing/AnalyticsSection';
import CustomerTestimonials from '@/components/branding-landing/CustomerTestimonials';
import FAQSection from '@/components/branding-landing/FAQSection';
import HeroSection from '@/components/branding-landing/HeroSection';
import HowItWorks from '@/components/branding-landing/HowItWorks';
import PricingSection from '@/components/branding-landing/PricingSection';
import ProblemSection from '@/components/branding-landing/ProblemSection';
import ProductFeatures from '@/components/branding-landing/ProductFeatures';
import SolutionSection from '@/components/branding-landing/SolutionSection';
import TalentAttraction from '@/components/branding-landing/TalentAttraction';
import TrustedCompanies from '@/components/branding-landing/TrustedCompanies';
import Footer from '@/components/landing/Footer';
import Navbar from '@/components/navbar/Navbar';
import ScrollToTop from '@/components/ui/ScrollToTop';


const EmployerBranding = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar/>
        <HeroSection/>
        <TrustedCompanies/>
        <ProblemSection/>
        <SolutionSection/>
        <ProductFeatures/>
        <HowItWorks/>
        <AnalyticsSection/>
        <TalentAttraction/>
        <CustomerTestimonials/>
        <FAQSection/>
        <PricingSection/>
        <ScrollToTop />
      <Footer/>
    </div>
  
  );
}

export default EmployerBranding
