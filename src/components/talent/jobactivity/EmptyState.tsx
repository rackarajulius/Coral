import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import EmptyIllustration from './EmptyIllustration';
import type { TabId } from './constants';

const EmptyState = ({ tab, heading, body, cta }: { tab: TabId; heading: string; body: string; cta: string }) => {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6 animate-fade-in">
      <EmptyIllustration variant={tab} />
      <h2 className="mt-10 text-lg font-bold text-[#1F2937]" style={{ letterSpacing: "-0.03em", lineHeight: 1.1 }}>
        {heading}
      </h2>
      <p className="mt-4 text-sm text-[#6B7280] max-w-[520px]" style={{ lineHeight: 1.7 }}>
        {body}
      </p>
      <div className="mt-8">
        <Button size="lg">{cta} <ArrowRight /></Button>
      </div>
    </div>
  );
};

export default EmptyState;
