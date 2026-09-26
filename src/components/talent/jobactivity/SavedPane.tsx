import { type SavedJob } from '@/data/jobactivity/job-activity-mock';
import { getMySavedJobs, unsaveJob } from '@/lib/api/savedJobs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Bookmark, Briefcase, Building2, CheckCircle2, Clock, DollarSign, MapPin, Share2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import CompanyMark from './CompanyMark';
import EmptyState from './EmptyState';
import ErrorState from './ErrorState';
import SkeletonPane from './SkeletonPane';
import RelatedJobs from './RelatedJobs';

const QUERY_KEY = ['my-saved-jobs'] as const;

function savedBadgeTone(badge: string): string {
  const b = badge.toLowerCase();
  if (b.includes("closing")) return "bg-[#FEF2F2] text-[#B91C1C]";
  if (b.includes("competition")) return "bg-[#FFFBEB] text-[#B45309]";
  if (b.includes("recently") || b.includes("new")) return "bg-[#EFF6FF] text-[#1D4ED8]";
  return "bg-[#F3F4F6] text-[#4B5563]";
}

const SavedPane = () => {
  const qc = useQueryClient();
  const { data: jobs = [], isLoading, isError, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: getMySavedJobs,
    staleTime: 60_000,
  });
  const [detailsJob, setDetailsJob] = useState<SavedJob | null>(null);
  const [showBar, setShowBar] = useState(false);
  const inlineActionsRef = useRef<HTMLDivElement>(null);

  const unsaveMut = useMutation({
    mutationFn: unsaveJob,
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: QUERY_KEY });
      const prev = qc.getQueryData<SavedJob[]>(QUERY_KEY);
      qc.setQueryData<SavedJob[]>(QUERY_KEY, (old) => (old ?? []).filter((j) => j.id !== id));
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(QUERY_KEY, ctx.prev);
      toast.error('Could not remove the saved job.');
    },
    onSettled: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
  const unsave = (id: string) => unsaveMut.mutate(id);

  const openDetails = (job: SavedJob) => {
    setShowBar(false);
    setDetailsJob(job);
  };
  const closeDetails = () => setDetailsJob(null);

  const handleShare = async (job: SavedJob) => {
    const url = `${window.location.origin}/jobs?title=${encodeURIComponent(job.title)}&company=${encodeURIComponent(job.company)}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${job.title} at ${job.company}`, url });
      } catch (err) {
        if ((err as Error).name !== "AbortError") toast.error("Unable to share this job");
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast("Link copied to clipboard");
    } catch {
      toast.error("Unable to copy link");
    }
  };

  // Reveal the sliding bar once the inline action buttons scroll past the top.
  const handleDrawerScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = inlineActionsRef.current;
    if (!el) return;
    setShowBar(e.currentTarget.scrollTop > el.offsetTop + el.offsetHeight);
  };

  const renderActions = (job: SavedJob, fullWidth = false) => (
    <>
      <Button size='sm' variant='default' className={fullWidth ? "flex-1" : undefined} aria-label={`Apply to ${job.title} at ${job.company}`}>
        Apply
      </Button>
      <Button
        size='icon'
        variant="outline"
        onClick={() => {
          unsave(job.id);
          closeDetails();
        }}
      >
        <Bookmark className="w-4 h-4 fill-current" />
      </Button>
      <Button
        size='icon'
        variant="outline"
        aria-label={`Share ${job.title}`}
        onClick={() => handleShare(job)}
      >
        <Share2 className="w-4 h-4" />
      </Button>
    </>
  );

  if (isLoading) return <SkeletonPane tab="saved" />;
  if (isError) return <ErrorState tab="saved" onRetry={() => refetch()} />;
  if (jobs.length === 0) {
    return (
      <EmptyState
        tab="saved"
        heading="No saved jobs yet"
        body="Jobs you save will appear here so you can revisit them anytime and stay organized throughout your job search."
        cta="Browse Jobs"
      />
    );
  }

  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 animate-fade-in">
      {jobs.map((j) => (
        <Card
          key={j.id}
          className="group h-full flex flex-col rounded-xl border border-gray-300 p-5 hover:shadow-md transition-all duration-300"
        >
          {/* Header */}
          <div className="flex items-start gap-4 mb-4">
            <CompanyMark letter={j.company[0]} seed={j.company} />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-m text-foreground truncate">{j.title}</h3>
              <p className="text-sm text-muted-foreground truncate">{j.company}</p>
            </div>
            <button
              type="button"
              onClick={() => unsave(j.id)}
              aria-pressed={true}
              aria-label={`${j.title} is saved. Activate to remove from saved jobs.`}
              className="shrink-0 text-[#F97316] rounded-sm transition-colors hover:text-[#9CA3AF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316] focus-visible:ring-offset-2"
            >
              <Bookmark className="w-5 h-5 fill-current" />
            </button>
          </div>

          {/* Badge + match (flex-1 keeps card heights equal) */}
          <div className="flex flex-wrap items-center gap-2 mb-4 flex-1">
            {j.badge && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${savedBadgeTone(j.badge)}`}>
                {j.badge}
              </span>
            )}
            {typeof j.match === "number" && (
              <span className="text-sm font-medium text-[#F97316]">{j.match}% match</span>
            )}
          </div>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground mb-4">
            <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {j.location}</span>
            <span className="flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" /> {j.salary}</span>
            <span className="flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" /> {j.type}</span>
          </div>

          {/* Footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-gray-300">
            <p className="text-xs text-muted-foreground">Saved {j.posted}</p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs font-medium h-8"
                onClick={() => openDetails(j)}
                aria-label={`View details for ${j.title} at ${j.company}`}
              >
                View details
              </Button>
              <Button
                size="sm"
                className="text-xs font-medium h-8 px-5"
                aria-label={`Apply to ${j.title} at ${j.company}`}
              >
                Apply
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>

    <Sheet open={detailsJob !== null} onOpenChange={(open) => !open && closeDetails()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 overflow-hidden">
        {detailsJob && (
          <div className="absolute inset-0 overflow-hidden">
            {/* Sliding action bar — slides down from the top once the inline buttons scroll away */}
            <div
              aria-hidden={!showBar}
              className={`absolute top-0 left-0 right-0 z-30 flex items-center gap-4 bg-background border-b border-border px-6 py-3 transition-transform duration-300 ease-in-out ${
                showBar ? "translate-y-0 shadow-sm" : "-translate-y-full pointer-events-none"
              }`}
            >
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-foreground truncate">{detailsJob.title}</h3>
                <p className="text-sm text-muted-foreground truncate">{detailsJob.company}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {renderActions(detailsJob)}
              </div>
            </div>

            {/* Scroll container */}
            <div onScroll={handleDrawerScroll} className="absolute inset-0 overflow-y-auto p-6">
            <SheetHeader className="text-left">
              <div className="flex items-start gap-4 pr-8">
                <CompanyMark letter={detailsJob.company[0]} seed={detailsJob.company} />
                <div className="min-w-0">
                  <SheetTitle className="truncate">{detailsJob.title}</SheetTitle>
                  <SheetDescription>{detailsJob.company}</SheetDescription>
                </div>
              </div>
            </SheetHeader>

            {(detailsJob.badge || typeof detailsJob.match === "number") && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {detailsJob.badge && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${savedBadgeTone(detailsJob.badge)}`}>
                    {detailsJob.badge}
                  </span>
                )}
                {typeof detailsJob.match === "number" && (
                  <span className="text-sm font-medium text-[#F97316]">{detailsJob.match}% match</span>
                )}
              </div>
            )}

            <dl className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="flex items-center gap-1.5 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                <dt className="sr-only">Location</dt>
                <dd className="text-foreground">{detailsJob.location}</dd>
              </div>
              <div className="flex items-center gap-1.5 text-sm">
                <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
                <dt className="sr-only">Salary</dt>
                <dd className="text-foreground">{detailsJob.salary}</dd>
              </div>
              <div className="flex items-center gap-1.5 text-sm">
                <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                <dt className="sr-only">Job type</dt>
                <dd className="text-foreground">{detailsJob.type}</dd>
              </div>
              <div className="flex items-center gap-1.5 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                <dt className="sr-only">Saved</dt>
                <dd className="text-muted-foreground">Saved {detailsJob.posted}</dd>
              </div>
            </dl>

            {/* Actions (inline; mirrored by the sliding top bar on scroll) */}
            <div ref={inlineActionsRef} className="mt-6 flex gap-2">
              {renderActions(detailsJob, true)}
            </div>

            {/* About the Role */}
            <div className="mt-6 space-y-6">
              <section>
                <h4 className="text-sm font-semibold text-foreground mb-2">About {detailsJob.company}</h4>
                {(detailsJob.companyIndustry || detailsJob.companySize) && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground mb-2">
                    {detailsJob.companyIndustry && (
                      <span className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> {detailsJob.companyIndustry}</span>
                    )}
                    {detailsJob.companySize && (
                      <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> {detailsJob.companySize}</span>
                    )}
                  </div>
                )}
                {detailsJob.companyAbout && (
                  <p className="text-sm text-muted-foreground leading-relaxed">{detailsJob.companyAbout}</p>
                )}
                <Button asChild variant="outline" size="sm" className="mt-3">
                  <Link to="/company-profile" aria-label={`View ${detailsJob.company} profile`}>
                    View profile <ArrowUpRight className="w-4 h-4" />
                  </Link>
                </Button>
              </section>

              {detailsJob.description && (
                <section>
                  <h4 className="text-sm font-semibold text-foreground mb-2">About the Role</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">{detailsJob.description}</p>
                </section>
              )}

              {detailsJob.responsibilities.length > 0 && (
                <section>
                  <h4 className="text-sm font-semibold text-foreground mb-2">Responsibilities</h4>
                  <ul className="space-y-2">
                    {detailsJob.responsibilities.map((r, idx) => (
                      <li key={idx} className="flex gap-2 text-sm text-foreground">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 bg-[#F97316]" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {detailsJob.benefits.length > 0 && (
                <section>
                  <h4 className="text-sm font-semibold text-foreground mb-2">Benefits</h4>
                  <ul className="space-y-2">
                    {detailsJob.benefits.map((b, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm text-foreground">
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-[#F97316]" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {detailsJob.skills.length > 0 && (
                <section>
                  <h4 className="text-sm font-semibold text-foreground mb-2">Skills</h4>
                  <div className="flex flex-wrap gap-2">
                    {detailsJob.skills.map((s, idx) => (
                      <span key={idx} className="px-2.5 py-1 rounded-full bg-muted text-xs font-medium text-foreground">
                        {s}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <RelatedJobs />
              </section>
            </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
    </>
  );
};

export default SavedPane;
