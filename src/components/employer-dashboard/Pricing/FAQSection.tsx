import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { FAQS } from '@/data/employer/pricing/pricing';
import React from 'react'

const FAQSection = () => {
  return (
     <Accordion type="single" collapsible className="space-y-3">
      {FAQS.map((item, i) => (
        <AccordionItem
          key={i}
          value={`item-${i}`}
          className="overflow-hidden rounded-xl border border-border bg-card px-5 [&[data-state=open]]:shadow-sm"
        >
          <AccordionTrigger className="py-4 text-left text-sm font-medium hover:no-underline">
            {item.q}
          </AccordionTrigger>
          <AccordionContent className="pb-4 text-sm text-muted-foreground">
            {item.a}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );

}

export default FAQSection
