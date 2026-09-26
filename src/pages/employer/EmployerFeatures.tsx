import HeroSection from '@/components/employerFeatures/HeroSection';
import BenefitsBar from '@/components/employerFeatures/BenefitsBar';
import FeaturesGrid from '@/components/employerFeatures/FeaturesGrid';
import ATS from '@/components/employerFeatures/ATS';
import AIMatching from '@/components/employerFeatures/AIMatching';
import Testimonials from '@/components/employerFeatures/Testimonials';
import Pricing from '@/components/employerFeatures/Pricing';
import CTA from '@/components/employerFeatures/CTA';
import Navbar from '@/components/navbar/Navbar';
import ScrollToTop from '@/components/ui/ScrollToTop';
import Footer from '@/components/landing/Footer';


const EmployerFeatures =() => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <HeroSection/>
      <BenefitsBar/>
      <FeaturesGrid/>
      <ATS/> 
      <AIMatching/>
      <Testimonials/>
      <Pricing/>  
      <CTA/>
       <ScrollToTop />
       <Footer/>
    </div>
  );
}

export default EmployerFeatures;
