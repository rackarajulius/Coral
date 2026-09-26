import { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, BadgeCheck, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import FollowButton from '@/components/company/FollowButton';
import { mockCompany } from '@/data/companies/profile/mockCompany';
import { EmployerCompany, getSimilarCompanies } from '@/lib/api/employerCompany';

const CARD_WIDTH = 265; // card width (245) + gap (20)

interface DisplayCard {
  id?: string;
  name: string;
  industry: string;
  desc: string;
  jobs: number;
  cover: string | null;
}

interface CompanySimilarProps {
  company?: EmployerCompany;
}

const CompanySimilar = ({ company }: CompanySimilarProps) => {
  const navigate = useNavigate();
  const otherRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const { data: similar = [] } = useQuery({
    queryKey: ['similar-companies', company?.id],
    queryFn: () => getSimilarCompanies(company!.id),
    enabled: !!company?.id,
    staleTime: 5 * 60 * 1000,
  });

  // Real company → its industry peers; mock preview → sample companies.
  const cards: DisplayCard[] = company
    ? similar.map((c) => ({ id: c.id, name: c.name, industry: c.industry, desc: c.description, jobs: c.openJobs, cover: c.cover }))
    : mockCompany.similarCompanies.map((c) => ({ name: c.name, industry: c.industry, desc: c.desc, jobs: c.jobs, cover: c.cover }));

  const updateFades = useCallback(() => {
    const el = otherRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  useEffect(() => {
    updateFades();
    window.addEventListener('resize', updateFades);
    return () => window.removeEventListener('resize', updateFades);
  }, [updateFades, cards.length]);

  const scrollCarousel = (direction: -1 | 1) => {
    otherRef.current?.scrollBy({ left: direction * CARD_WIDTH, behavior: 'smooth' });
  };

  if (cards.length === 0) return null;

  return (
    <section className="pb-24">
      <div className="container mx-auto px-6">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Discover more</p>
            <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">Companies you might love.</h2>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="rounded-full"
              disabled={!canScrollLeft}
              onClick={() => scrollCarousel(-1)}
              aria-label="Previous"
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="rounded-full"
              disabled={!canScrollRight}
              onClick={() => scrollCarousel(1)}
              aria-label="Next"
            >
              <ChevronRight />
            </Button>
          </div>
        </div>

        <div
          ref={otherRef}
          onScroll={updateFades}
          className="mt-8 flex gap-5 overflow-x-auto snap-x snap-mandatory pb-4 no-scrollbar"
        >
          {cards.map((c, i) => (
            <Card
              key={c.id ?? `${c.name}-${i}`}
              className="shrink-0 snap-start w-[220px] sm:w-[245px] rounded-2xl
               overflow-hidden border-border hover:shadow-md transition-all duration-300"
            >
              <div className="h-24 w-full overflow-hidden bg-secondary flex items-center justify-center">
                {c.cover ? (
                  <img src={c.cover} alt={c.name} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <Building2 className="h-7 w-7 text-muted-foreground/50" />
                )}
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold truncate">{c.name}</h3>
                  <BadgeCheck className="h-4 w-4 text-primary shrink-0" />
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{c.industry}</p>
                {c.desc && <p className="mt-3 text-sm text-muted-foreground line-clamp-2">{c.desc}</p>}
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{c.jobs} open jobs</span>
                  <div className="flex gap-1.5">
                    <FollowButton companyId={c.id} skin="compact" />
                    <Button
                      size="sm"
                      className="rounded-full h-8 bg-orange-500 hover:bg-orange-600 text-white"
                      onClick={() => navigate(c.id ? `/company-profile/${c.id}` : '/company-profile')}
                    >
                      View
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CompanySimilar;
