import Comparison from '@/components/al-hiring/Comparison'
import ConversionCTA from '@/components/al-hiring/ConversionCTA'
import FeaturesGrid from '@/components/al-hiring/FeaturesGrid'
import Hero from '@/components/al-hiring/Hero'
import HowItWorks from '@/components/al-hiring/HowItWorks'
import ProblemStatement from '@/components/al-hiring/ProblemStatement'
import Testimonials from '@/components/al-hiring/Testimonials'
import TrustSection from '@/components/al-hiring/TrustSection'
import Footer from '@/components/landing/Footer'
import EmployerNavbar from '@/components/landing/Navbar'
import Navbar from '@/components/navbar/Navbar'
import ScrollToTop from '@/components/ui/ScrollToTop'
import React from 'react'

const AIHiring = () => {
  return (
    <div className="min-h-screen bg-background">
        <Navbar/>
        <Hero/>
        <ProblemStatement/>
        <HowItWorks/>
        <FeaturesGrid/> 
         <TrustSection/>
         <Comparison/>
         <Testimonials/>
         <ConversionCTA/>
         <ScrollToTop />
          <Footer/>
    </div>
  )
}

export default AIHiring
