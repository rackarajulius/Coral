import { useRef, useState, useEffect, RefObject } from "react";
import { MapPin, Clock, DollarSign, Building2, Bookmark, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Job } from "@/data/jobs/jobs";
import { resolveJobIcon } from "@/lib/utils";
import SlidingApplyBar from "@/components/jobs/findJobs/SlidingApplyBar";
import ApplyDialog from "@/components/jobs/ApplyDialog";
import { useApply } from "@/hooks/useApply";
import { trackPageSource } from "@/lib/api/analyticsEvents";

interface JobDetailsProps {
  job: Job;
  isMobile?: boolean;
  scrollContainerRef?: RefObject<HTMLDivElement>;
}

const JobDetails = ({ job, isMobile = false, scrollContainerRef }: JobDetailsProps) => {
  const { hasApplied, target, setTarget, startApply, markApplied } = useApply();
  const applied = hasApplied(job.id);
  const external = job.applicationMethod && job.applicationMethod !== "internal";
  // "Applied" tracking only exists for on-platform applications.
  const isApplied = applied && !external;
  const applyLabel = external
    ? job.applicationMethod === "email"
      ? "Apply by Email"
      : "Apply on Company Site"
    : isApplied
      ? "Applied"
      : "Apply Now";
  const desktopScrollRef = useRef<HTMLDivElement>(null);
  const primaryApplyRef = useRef<HTMLDivElement>(null);
  const [showStickyBar, setShowStickyBar] = useState(false);

  // Get the correct scroll container
  const getScrollContainer = () => {
    if (isMobile && scrollContainerRef?.current) {
      return scrollContainerRef.current;
    }
    return desktopScrollRef.current;
  };

  // Reset sticky bar INSTANTLY when job changes
  useEffect(() => {
    setShowStickyBar(false);
  }, [job.id]);

  // Where this visit came from. Reported once per job per session, and only
  // from the browser — the API's own Referer header is our page, not the
  // site the visitor actually arrived from.
  useEffect(() => {
    trackPageSource({ jobId: job.id });
  }, [job.id]);

  // IntersectionObserver to show/hide sticky bar (works on both mobile and desktop)
  useEffect(() => {
    const scrollContainer = getScrollContainer();
    const primaryApply = primaryApplyRef.current;

    if (!primaryApply || !scrollContainer) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowStickyBar(!entry.isIntersecting);
      },
      {
        root: scrollContainer,
        threshold: 0,
        rootMargin: "-1px 0px 0px 0px",
      }
    );

    observer.observe(primaryApply);

    return () => observer.disconnect();
  }, [job.id, isMobile, scrollContainerRef]);

  // Shared content renderer
  const renderJobContent = () => (
    <div className="space-y-6">
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">
          About the Role
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          {job.description}
        </p>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">
          Responsibilities
        </h2>
        <ul className="space-y-2">
          {job.responsibilities.map((item, index) => (
            <li key={index} className="flex gap-2 text-muted-foreground">
              <span className="text-coral">•</span>
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">
          Requirements
        </h2>
        <ul className="space-y-2">
          {job.requirements.map((item, index) => (
            <li key={index} className="flex gap-2 text-muted-foreground">
              <span className="text-coral">•</span>
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">
          Benefits
        </h2>
        <ul className="space-y-2">
          {job.benefits.map((item, index) => (
            <li key={index} className="flex gap-2 text-muted-foreground">
              <span className="text-coral">•</span>
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">
          Skills
        </h2>
        <div className="flex flex-wrap gap-2">
          {job.tags.map((tag) => (
            <span
              key={tag}
              className="px-3 py-1.5 text-sm font-medium rounded-full bg-muted text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      </section>
    </div>
  );

  // Mobile layout - with top-sliding apply bar (scroll container is external)
  if (isMobile) {
    return (
      <div className="relative min-h-full">
        {/* Top-Sliding Apply Bar for Mobile - absolute positioned at top-0 */}
        
        <SlidingApplyBar job={job} isVisible={showStickyBar} isMobile={true} onApply={() => startApply(job)} applied={isApplied} applyLabel={external ? applyLabel : undefined} />
        <ApplyDialog
          open={!!target}
          onOpenChange={(o) => !o && setTarget(null)}
          job={target ?? { id: job.id, title: job.title, company: job.company }}
          onApplied={markApplied}
        />

        

        <div className="p-6 pt-4 pb-24">
          {/* Primary Apply Section */}
          <div ref={primaryApplyRef} className="mb-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-card 
              flex items-center justify-center">
                <Building2 className="h-7 w-7 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <h1 className="font-display text-xl font-bold text-foreground mb-1">
                  {job.title}
                </h1>
                <p className="text-muted-foreground">{job.company}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mb-4">
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {job.location}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                {job.type}
              </span>
              <span className="flex items-center gap-1.5">
                <DollarSign className="h-4 w-4" />
                {job.salary}
              </span>
            </div>

            {/* Primary Apply Button */}
            <div className="flex gap-3">
              <Button
                variant="default"
                size="icon"
                className="flex-1"
                disabled={isApplied}
                onClick={() => startApply(job)}
              >
                {applyLabel}
              </Button>
              <Button variant="outline" size="icon">
                <Bookmark className="h-5 w-5" />
              </Button>
              <Button variant="outline" size="icon">
               <Share2 className="h-4 w-4" />
               </Button>
            </div>
          </div>

          {/* Job Description */}
          {renderJobContent()}
        </div>
      </div>
    );
  }

  // Desktop layout with sticky bar
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card">
      {/* Sliding Apply Bar */}
      <SlidingApplyBar job={job} isMobile={false} isVisible={showStickyBar} onApply={() => startApply(job)} applied={isApplied} applyLabel={external ? applyLabel : undefined} />
        <ApplyDialog
          open={!!target}
          onOpenChange={(o) => !o && setTarget(null)}
          job={target ?? { id: job.id, title: job.title, company: job.company }}
          onApplied={markApplied}
        />


      {/* Scrollable Content */}
      <div
        ref={desktopScrollRef}
        className="h-[calc(100vh-8rem)] overflow-y-auto scrollbar"
      >
        <div className="p-6">
          {/* Primary Apply Section */}
          <div ref={primaryApplyRef} className="mb-8">
            <div className="flex items-start gap-4 mb-6">
              <div className="flex-shrink-0 w-16 h-16 rounded-xl bg-muted shadow-inner flex items-center justify-center overflow-hidden p-2">
               <img
              className="h-full w-full object-contain"
              src={resolveJobIcon(job.icon)}
              alt={`${job.company} logo`}
              width="32"
              height="32"
            />
              </div>
              
              <div className="flex-1">
                <h1 className="font-display text-2xl font-bold text-foreground mb-1">
                  {job.title}
                </h1>
                <p className="text-lg text-muted-foreground">{job.company}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-6">
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {job.location}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                {job.type}
              </span>
              <span className="flex items-center gap-1.5">
                <DollarSign className="h-4 w-4" />
                {job.salary}
              </span>
            </div>

            <div className="flex gap-3">
              <Button
                variant="default"
                size="sm"
                className="flex-1"
                disabled={isApplied}
                onClick={() => startApply(job)}
              >
                {applyLabel}
              </Button>
              <Button variant="outline" size="icon">
                <Bookmark className="h-5 w-5" />
              </Button>
              <Button variant="outline" size="icon">
               <Share2 className="h-4 w-4" />
               </Button>
            </div>
          </div>

          {/* Job Description */}
          <div className="space-y-6">
            <section>
              <h2 className="font-display text-lg font-semibold text-foreground mb-3">
                About the Role
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {job.description}
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold text-foreground mb-3">
                Responsibilities
              </h2>
              <ul className="space-y-2">
                {job.responsibilities.map((item, index) => (
                  <li key={index} className="flex gap-2 text-muted-foreground">
                    <span className="text-coral">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold text-foreground mb-3">
                Requirements
              </h2>
              <ul className="space-y-2">
                {job.requirements.map((item, index) => (
                  <li key={index} className="flex gap-2 text-muted-foreground">
                    <span className="text-coral">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold text-foreground mb-3">
                Benefits
              </h2>
              <ul className="space-y-2">
                {job.benefits.map((item, index) => (
                  <li key={index} className="flex gap-2 text-muted-foreground">
                    <span className="text-coral">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold text-foreground mb-3">
                Skills
              </h2>
              <div className="flex flex-wrap gap-2">
                {job.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1.5 text-sm font-medium rounded-full bg-muted text-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobDetails;
