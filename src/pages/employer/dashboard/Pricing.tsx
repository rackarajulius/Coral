import EmployerLayout from '@/components/employer-dashboard/Layout/EmployerLayout';
import BillingToggle from '@/components/employer-dashboard/Pricing/billingtoggle';
import FAQSection from '@/components/employer-dashboard/Pricing/FAQSection';
import FinalCta from '@/components/employer-dashboard/Pricing/FinalCta';
import PricingCards from '@/components/employer-dashboard/Pricing/PricingCards';
import RoiSection from '@/components/employer-dashboard/Pricing/RoiSection';
import Testimonials from '@/components/employer-dashboard/Pricing/Testimonials';
import React, { useState } from 'react'

const Pricing = () => {
     const [yearly, setYearly] = useState(true);
  return (
     <div className="p-6 space-y-6">{/* Header */}
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Pricing Plans</h1>
            <p className="text-sm text-muted-foreground mt-1"> Choose the perfect plan for your team</p>
          </div> 
        </div>

        {/*Billing Toggle*/}
          <div className="flex flex-col gap-10">
          <BillingToggle yearly={yearly} onChange={setYearly} />
          <PricingCards yearly={yearly}/>
          <RoiSection/>
          </div>


        <section className="py-24 px-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
                {/* Left Column - Header */}
          <div className="lg:sticky lg:top-24">
            <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-4xl">
               Frequently asked questions
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
               Everything you need to know about plans and billing.
            </p>
          </div>
          {/* Right Caolumn - Accordion */}
          <div>
            <FAQSection />
          </div>
            </div>
        </section>
       <FinalCta/>
       <Testimonials/>
       
      </div>
  )
}

export default Pricing;
