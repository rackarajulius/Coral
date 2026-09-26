import { useRef, useState, useEffect, RefObject } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Building2 } from "lucide-react";
import { Job } from "@/data/jobs";
import JobFitPanel from "@/components/jobs/JobFitPanel";
import AboutCompanySection from "@/components/jobs/AboutCompanySection";
import { JobActions, type JobNextStep } from "@/components/jobs/JobActions";
import { useAuth } from "@/contexts/AuthContext";
import { getMyScreens } from "@/lib/api/aiScreen";
import ApplyDialog from "@/components/jobs/ApplyDialog";
import { useApply } from "@/hooks/useApply";
import { trackPageSource } from "@/lib/api/analyticsEvents";
import { shareJob } from "@/lib/jobs/shareJob";
import { useSavedJob } from "@/hooks/useSavedJob";
import { resolveJobIcon } from "@/lib/utils";
import SlidingApplyBar from "./SlidingApplyBar";

interface JobDetailsProps {
  job: Job;
  isMobile?: boolean;
  scrollContainerRef?: RefObject<HTMLDivElement>;
}

const JobDetails = ({ job, isMobile = false, scrollContainerRef }: JobDetailsProps) => {
  const { hasApplied, appliedAt, appliedKnown, applicationFor, target, setTarget, startApply, markApplied } =
    useApply();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  /**
   * "Applied" only means something for on-platform applications. An external
   * or email route leaves our system at the click, so we cannot know whether
   * anyone actually finished — and claiming they did would be a guess shown as
   * a fact.
   */
  const isInternal = (job.applicationMethod ?? "internal") === "internal";
  const applied = isInternal && hasApplied(job.id);

  /**
   * What comes after applying — and only after applying.
   *
   * Practice is offered for a job the person applied to here and hasn't
   * withdrawn from; the server enforces the same rule. Jobs applied to on
   * another site never qualify, because we can't know that happened.
   *
   * If the employer has invited them to an AI screening for this job, that is
   * the real thing and comes first — two similar buttons would be confusing.
   * Employers and admins browse jobs too, and practice isn't for them.
   */
  const isSeeker = user?.role === "JOB_SEEKER";
  const canPractise =
    applied && isAuthenticated && isSeeker && applicationFor(job.id)?.status !== "withdrawn";

  /**
   * One list for the whole visit, not per job: it is asked for as soon as a
   * job seeker is browsing, so the answer is usually already here when they
   * open a job they applied to.
   */
  const screensQuery = useQuery({
    queryKey: ["my-screens", user?.id],
    queryFn: getMyScreens,
    enabled: isAuthenticated && isSeeker,
    staleTime: 60_000,
    retry: false,
  });
  const screening = screensQuery.data?.find((s) => s.jobId === job.id && s.status === "invited");

  /**
   * Nothing is offered until that answer is in. A button that reads "Practice
   * for this interview" and then turns into "Take your screening" under the
   * cursor is worse than one that appears a moment later — and a mis-click
   * would start practice instead of the real screening.
   */
  const screeningKnown = screensQuery.data !== undefined || screensQuery.isError;
  const nextStep: JobNextStep | null =
    !canPractise || !screeningKnown
      ? null
      : screening
        ? { kind: "screening", onClick: () => navigate(`/ai-screen/${screening.id}`) }
        : { kind: "practice", onClick: () => navigate(`/interview-prep?job=${encodeURIComponent(job.id)}`) };
  const desktopScrollRef = useRef<HTMLDivElement>(null);
  const primaryApplyRef = useRef<HTMLDivElement>(null);
  const [showStickyBar, setShowStickyBar] = useState(false);
  const { isSaved, toggle: toggleSave } = useSavedJob(job);

  // Get the correct scroll container
  const getScrollContainer = () => {
    if (isMobile && scrollContainerRef?.current) {
      return scrollContainerRef.current;
    }
    return desktopScrollRef.current;
  };

  // Where this visit came from. Reported once per job per session, and only
  // from the browser — the API's own Referer header is our page, not the site
  // the visitor actually arrived from.
  useEffect(() => {
    trackPageSource({ jobId: job.id });
  }, [job.id]);

  // Reset sticky bar INSTANTLY when job changes
  useEffect(() => {
    setShowStickyBar(false);
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
    <div className="space-y-4">
      {/* Where you stand + how to strengthen the application. */}
      <JobFitPanel jobId={job.id} />

      <AboutCompanySection job={job} />

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
        
        <SlidingApplyBar
          job={job}
          isVisible={showStickyBar}
          isMobile={true}
          applied={applied}
          appliedKnown={appliedKnown}
          nextStep={nextStep}
          onApply={() => startApply(job)}
          onShare={() => void shareJob(job)}
        />

        {/* One dialog per layout branch, driven by the same `target` state, so
            the two can never disagree about what is being applied to. */}
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
              <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-muted
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
              <span className="px-2.5 py-1 rounded-full bg-muted text-foreground text-xs">{job.type}</span>
              <span>{job.salary}</span>
            </div>

            <JobActions
              job={job}
              isSaved={isSaved}
              onToggleSave={toggleSave}
              applied={applied}
              appliedKnown={appliedKnown}
              appliedAt={appliedAt(job.id)}
              nextStep={nextStep}
              onApply={() => startApply(job)}
              onShare={() => void shareJob(job)}
            />
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
      <SlidingApplyBar
        job={job}
        isMobile={false}
        isVisible={showStickyBar}
        applied={applied}
        appliedKnown={appliedKnown}
        nextStep={nextStep}
        onApply={() => startApply(job)}
        onShare={() => void shareJob(job)}
      />

      {/* One dialog per layout branch, driven by the same `target` state, so
          the two can never disagree about what is being applied to. */}
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
              className="h-full rounded-sm w-full object-contain"
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
              <span className="px-2.5 py-1 rounded-full bg-muted text-foreground text-xs">{job.type}</span>
              <span>{job.salary}</span>
            </div>

            <JobActions
              job={job}
              isSaved={isSaved}
              onToggleSave={toggleSave}
              applied={applied}
              appliedKnown={appliedKnown}
              appliedAt={appliedAt(job.id)}
              nextStep={nextStep}
              onApply={() => startApply(job)}
              onShare={() => void shareJob(job)}
            />
          </div>

          {/* The same content the mobile path renders. It was duplicated here
              without JobFitPanel or AboutCompanySection, so desktop silently
              lost both — nobody notices a section that was never there. */}
          {renderJobContent()}
        </div>
      </div>
    </div>
  );
};

export default JobDetails;
