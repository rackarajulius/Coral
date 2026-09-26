import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";


const faqs = [
  {
    question: "What is Employer Branding and why does it matter?",
    answer: "Employer Branding is the process of positioning your company as the employer of choice to attract, engage, and retain top talent. It matters because 75% of job seekers consider an employer's brand before applying. A strong employer brand reduces cost-per-hire by up to 50% and decreases turnover by 28%."
  },
  {
    question: "How long does it take to set up an Employer Profile?",
    answer: "Most companies complete their premium profile within 1-2 weeks. Our onboarding team provides a dedicated account manager who guides you through content creation, photo/video uploads, and optimization. We also offer expedited 48-hour setup for urgent hiring campaigns."
  },
  {
    question: "What's included in the pricing?",
    answer: "Our pricing includes your custom employer profile, Featured Employer badge, access to our photo/video gallery tools, employee testimonial management, analytics dashboard, and social amplification features. Enterprise plans include dedicated support, custom integrations, and priority placement in candidate searches."
  },
  {
    question: "Can I update my profile content anytime?",
    answer: "Absolutely. Your employer profile is fully self-service with unlimited updates. You can refresh photos, add new testimonials, update your mission statement, and modify your company culture content whenever you want—no additional fees or waiting periods."
  },
  {
    question: "How do you measure the ROI of Employer Branding?",
    answer: "We provide comprehensive analytics including profile views, candidate engagement rates, application conversion rates, and quality-of-hire metrics. On average, our clients see a 3.5x increase in quality applicants and a 40% reduction in time-to-fill within the first 90 days."
  },
  {
    question: "Do you offer a trial or demo?",
    answer: "Yes, we offer a 14-day free trial for our Professional plan, giving you full access to all features. We also provide personalized demos where our team walks you through the platform and helps you understand how it can work for your specific hiring needs."
  }
];

const FAQSection = () => {
  return (
    <section className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          {/* Left Column - Header */}
          <div className="lg:sticky lg:top-24">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Everything you need to know about building your employer brand and attracting top talent.
            </p>
            <div>
              <p className="text-muted-foreground mb-4">
                Still have questions? We're here to help.
              </p>
              <Button
                size="lg"
               variant="default"
                className="inline-flex items-center text-white font-semibold hover:underline transition-all rounded-full"
              >
                Contact our team →
              </Button>
            </div>
          </div>

          {/* Right Column - Accordion */}
          
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="border border-border rounded-xl px-6 data-[state=open]:shadow-sm transition-shadow">
                <AccordionTrigger className="text-left font-medium text-foreground hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        
          
        </div>
      </div>
    </section>
  );
};

export default FAQSection;
