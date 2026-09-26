import { ArrowRight } from 'lucide-react'
import React from 'react'
import { Button } from '../ui/button'

const CTA = () => {
  return (
    <section className="py-20 px-6">
         <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-5">
            Ready to Transform Your Hiring?
          </h2>
          <p className="text-muted-foreground text-lg mb-10 leading-relaxed">
            Join thousands of companies using our platform to find and hire great talent.
            Start your free trial today no credit card required.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button variant="default" size="lg" className="rounded-full">
              Start Free Trial <ArrowRight className="ml-1 h-5 w-5" />
            </Button>
            <Button variant="outline" size="lg" className="rounded-full" asChild>
              <a href="#pricing">View Pricing</a>
            </Button>
          </div>
        </div>
      
    </section>
  )
}

export default CTA
