import { useEffect, useState } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Header from '@/components/Header';
import { Skeleton } from '@/components/ui/skeleton';
import CompanyHero from '@/components/company/CompanyHero';
import CompanyNav from '@/components/company/CompanyNav';
import CompanyAbout from '@/components/company/CompanyAbout';
import CompanyEVP from '@/components/company/CompanyEVP';
import CompanyTestimonials from '@/components/company/CompanyTestimonials';
import CompanyCulture from '@/components/company/CompanyCulture';
import CompanyDiversity from '@/components/company/CompanyDiversity';
import CompanyMediaGallery from '@/components/company/CompanyMediaGallery';
import CompanyBenefits from '@/components/company/CompanyBenefits';
import CompanyJobs from '@/components/company/CompanyJobs';
import CompanyHiringStats from '@/components/company/CompanyHiringStats';
import CompanyHiringCommitments from '@/components/company/CompanyHiringCommitments';
import CompanyTides from '@/components/company/CompanyTides';
import CompanyCommunityPosts from '@/components/company/CompanyCommunityPosts';
import { companyPath } from '@/lib/api/community';
import InView from '@/components/common/InView';
import Awards from '@/components/company/Awards&Certs';
import CompanyReviews from '@/components/company/CompanyReviews';
import CompanyRatingSummary from '@/components/company/CompanyRatingSummary';
import CompanySimilar from '@/components/company/CompanySimilar';
import { Button } from '@/components/ui/button';
import { EmployerCompany, getCompanyById } from '@/lib/api/employerCompany';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { trackPageSource } from '@/lib/api/analyticsEvents';

const CompanyProfile = () => {
  const { id } = useParams<{ id?: string }>();
  const location = useLocation();
  // Set by the company's community page, so this page can offer the way back.
  const cameFromCommunity = (location.state as { from?: string } | null)?.from === 'community';
  const [company, setCompany] = useState<EmployerCompany | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(!!id);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    (async () => {
      try {
        const data = await getCompanyById(id);
        if (!cancelled) {
          setCompany(data);
          // Attribute to the owning user the API resolved — the route param
          // may be a slug or a profile id, neither of which is the employer.
          const ownerId = (data as { userId?: string }).userId;
          if (ownerId) trackPageSource({ companyUserId: ownerId });
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load company');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Named above the early returns so the hook runs on every render, whichever
  // state the page is in. Null while loading — the id in the URL is a slug or a
  // profile id, neither of which is a name worth putting in a tab.
  useDocumentTitle(
    error ? 'Company not found' : company?.companyName ? `${company.companyName} careers` : null,
  );

  if (id && isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          {/* Hero skeleton */}
          <section className="pt-20 w-full">
            <div className="rounded-xl border border-slate-200 dark:border-gray-700 overflow-hidden">
              <Skeleton className="h-48 md:h-64 w-full rounded-none" />
              <div className="px-4 md:px-8 pb-8">
                <div className="flex items-end gap-5 -mt-12 mb-6">
                  <Skeleton className="h-24 w-24 md:h-32 md:w-32 rounded-xl shrink-0" />
                </div>
                <Skeleton className="h-8 w-64 mb-3" />
                <Skeleton className="h-4 w-80 mb-4" />
                <div className="flex flex-wrap gap-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
            </div>
          </section>

          {/* Nav skeleton */}
          <div className="flex gap-3 mt-4 mb-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-24 rounded-full" />
            ))}
          </div>

          {/* Section skeletons */}
          <div className="space-y-8">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-slate-200 p-6 space-y-3">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (id && error) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-32 pb-20 text-center">
          <h1 className="text-xl font-semibold mb-2">Company not found</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button asChild variant="default">
            <Link to="/companies">Back to companies</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <section className="pt-20 w-full">
          {cameFromCommunity && id && (
            <Link
              to={companyPath(id)}
              className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to the community
            </Link>
          )}
          <CompanyHero company={company} />
        </section>

        <CompanyNav />

        <div className="mt-6">
          <main className="space-y-8">
            <article id="about">
              <CompanyAbout company={company} />
            </article>

            <section className="space-y-8">
              <CompanyEVP company={company} />
              <CompanyCulture company={company} />
              <CompanyMediaGallery company={company} />
              <CompanyTestimonials company={company} />
              <CompanyBenefits company={company} />
              <Awards company={company} />
              <CompanyDiversity company={company} />
            </section>

            {/* Deferred until it is nearly on screen. This page stacks a
                dozen sections and several fetch on mount, so opening it fired
                half a dozen requests at once for material most readers never
                scroll to. */}
            {/* What the company says in the community, beside what it is
                holding there. Hides itself when it has posted nothing. */}
            <InView>
              <CompanyCommunityPosts company={company} />
            </InView>

            <InView>
              <CompanyTides company={company} />
            </InView>

            {/* Before the reviews: what people say about a company and what
                it measurably does are two different kinds of evidence, and
                this is the one no employer can write. */}
            <InView>
              <CompanyHiringStats company={company} />
            </InView>

            {/* The same kind of evidence: read from postings and interviews,
                where a careers page would carry the company's own claims. */}
            <InView>
              <CompanyHiringCommitments company={company} />
            </InView>

            <section id="reviews" className="space-y-4">
              {/* Both read the same query key, so the aggregate and the list
                  can never describe different fetches. */}
              <CompanyRatingSummary employerId={(company as { userId?: string })?.userId} />
              <CompanyReviews employerId={(company as { userId?: string })?.userId} />
            </section>

            <section id="jobs">
              <CompanyJobs company={company} />
            </section>

            <footer>
              <CompanySimilar company={company} />
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
};

export default CompanyProfile;
