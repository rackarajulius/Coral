import { useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Target, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { mockCompany } from '@/data/companies/profile/mockCompany';
import { EmployerCompany } from '@/lib/api/employerCompany';

interface CompanyAboutProps {
  company?: EmployerCompany;
}

const CompanyAbout = ({ company }: CompanyAboutProps) => {
  const [expanded, setExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const overviewRef = useRef<HTMLParagraphElement>(null);

  const name = company ? company.companyName : mockCompany.name;
  const overview = company ? company.overview : mockCompany.overview;
  const mission = company ? company.mission : mockCompany.mission;
  const vision = company ? company.vision : mockCompany.vision;
  // Real profiles carry their own core values; the mock preview uses sample ones.
  const coreValues = company ? (company.coreValues ?? []) : mockCompany.values;

  // Only show the toggle when the clamped overview actually overflows. Measured
  // while collapsed (the clamp is off once expanded, so we keep the last result).
  useLayoutEffect(() => {
    const el = overviewRef.current;
    if (!el || expanded) return;
    const check = () => setIsOverflowing(el.scrollHeight > el.clientHeight + 1);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [overview, expanded]);

  // A real company that has written none of this gets no card at all. Every
  // field inside is already guarded, so without this the section rendered as a
  // heading over nothing.
  if (company && !overview && !mission && !vision && coreValues.length === 0) return null;

  return (
    <Card id="overview" className="border-border/50 rounded-2xl">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">About {name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {overview && (
          <div>
            <p
              ref={overviewRef}
              className={`text-muted-foreground text-sm leading-relaxed ${!expanded ? 'line-clamp-3' : ''}`}
            >
              {overview}
            </p>
            {(isOverflowing || expanded) && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-primary text-sm font-medium mt-2 flex items-center gap-1 hover:underline"
              >
                {expanded ? 'Show less' : 'Read more'}
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            )}
          </div>
        )}

        {(mission || vision) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {mission && (
              <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="h-4 w-4 text-primary" />
                  <h4 className="font-semibold text-sm">Mission</h4>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{mission}</p>
              </div>
            )}
            {vision && (
              <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="h-4 w-4 text-primary" />
                  <h4 className="font-semibold text-sm">Vision</h4>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{vision}</p>
              </div>
            )}
          </div>
        )}

        {coreValues.length > 0 && (
          <div>
            <h4 className="font-semibold text-sm mb-3">Core Values</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {coreValues.map((v) => (
                <div key={v.title} className="flex gap-3 p-3 rounded-xl border border-border/50 hover:bg-muted/30 transition-colors">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-primary text-xs font-bold">{v.title.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{v.title}</p>
                    {v.description && <p className="text-xs text-muted-foreground">{v.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CompanyAbout;
