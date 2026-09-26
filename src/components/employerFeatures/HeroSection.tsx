import React from 'react'
import { Button } from '../ui/button'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

const HeroSection = () => {
  return (
    <section className="relative overflow-hidden px-4 xsm:px-6 
      pt-20 pb-12 
      sm:pt-32 sm:pb-20 
      lg:pt-40 lg:pb-32 
      text-center">
      
      {/* Background Blobs - Responsive Scaling */}
      <div className="absolute inset-0 blob-indigo opacity-40 pointer-events-none" />
      <div className="absolute -bottom-20 -right-20 blob-rose opacity-20 
        w-[300px] h-[300px] 
        md:w-[500px] md:h-[500px] 
        bs:w-[600px] bs:h-[600px] 
        pointer-events-none" />

      <div className="relative z-10 max-w-xs xs:max-w-md sm:max-w-2xl bs:max-w-3xl lg:max-w-4xl mx-auto">
        
        {/* Headline with fluid typography using your breakpoints */}
        <h1 className="font-extrabold tracking-tight text-foreground mb-4 sm:mb-6
          text-3xl 
          xs:text-4xl 
          md:text-5xl 
          bs:text-6xl 
          xl:text-7xl">
          Everything You Need to{' '}
          <span className="gradient-text-hero block sm:inline">Hire Great Talent</span>
        </h1>

         {/* Description */}
        <p className="text-sm xsm:text-base xs:text-lg md:text-xl text-muted-foreground max-w-xs xsm:max-w-sm xs:max-w-md sm:max-w-xl md:max-w-2xl mx-auto mb-6 xs:mb-8 md:mb-10 leading-relaxed">
          From applicant tracking to AI-powered matching, our comprehensive suite of tools
          helps you find, engage, and hire the best candidates faster.
        </p>

        {/* Action Buttons - Stacked on tiny screens, Row on SM+ */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
          <Button
            variant="default"
            size="lg"
            className="w-full sm:w-auto px-8 h-12 bs:h-14 bs:text-lg rounded-full"
            asChild
          >
            <Link to="/create-employer-brand">
              Get Started <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
          
          <Button
            variant="outline"
            size="lg"
            className="w-full sm:w-auto px-8 h-12 bs:h-14 bs:text-lg rounded-full"
            asChild
          >
            <a href="#pricing">View Pricing</a>
          </Button>
        </div>

        {/* Optional: Trust Badge / Small Caption */}
        <p className="mt-8 text-xs font-medium uppercase tracking-widest text-muted-foreground/60">
          Trusted by 500+ forward-thinking teams
        </p>
      </div>
    </section>
  )
}

export default HeroSection