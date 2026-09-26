import { useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/hooks/useAppDispatch";
import { useIsMobile } from "@/hooks/use-mobile";
import { useJobMatches } from "@/hooks/useJobMatches";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import {
  setSelectedJobId,
  setMobileScrollPosition,
  setLoading,
  setJobs,
  resetFilters,
  selectFilteredJobs,
  selectCurrentJob,
} from "@/store/jobsSlice";
import { fetchPublicJobs } from "@/lib/jobs/fetchJobs";
import { reportRecommendationOpened } from "@/lib/api/recommendations";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import JobCard from "./JobCard";
import RecommendedJobs from "./RecommendedJobs";
import JobDetails from "./JobDetails";
import JobListingsFooter from "./JobListingsFooter";
import FilterDrawer from "./FilterDrawer";
import EmptyState from "./EmptyState";
import SearchBar from "./SearchBar";
import EmailAlertCard from "./EmailAlertCard";
import JobCardSkeleton from "./JobCardSkeleton";
import JobDetailsSkeleton from "./JobDetailsSkeleton";

const SKELETON_COUNT = 5;

const JobListings = () => {
  const dispatch = useAppDispatch();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedJobId = useAppSelector((s) => s.jobs.selectedJobId);
  const mobileScrollPosition = useAppSelector((s) => s.jobs.mobileScrollPosition);
  const filteredJobs = useAppSelector(selectFilteredJobs);
  const allJobs = useAppSelector((s) => s.jobs.jobs);

  // AI fit scores for whatever is on screen (batched + cached server-side).
  const visibleIds = useMemo(() => filteredJobs.map((j) => j.id), [filteredJobs]);
  const { matches } = useJobMatches(visibleIds);
  const currentJob = useAppSelector(selectCurrentJob);
  const isLoading = useAppSelector((state) => state.jobs.isLoading);

  // The tab follows the open listing, so several job tabs stay tellable
  // apart and a bookmark records which job it was. Null while the list is
  // still loading — the id is in the URL but the title is not known yet.
  useDocumentTitle(currentJob ? `${currentJob.title} at ${currentJob.company}` : "Find jobs");

  const mobileDetailRef = useRef<HTMLDivElement>(null);
  const prevIsMobileRef = useRef(isMobile);

  const hasJobs = filteredJobs.length > 0;
  const showMobileDetails = isMobile && !!selectedJobId;

  useEffect(() => {
    dispatch(setLoading(true));
    fetchPublicJobs({ limit: 100 })
      .then((jobs) => {
        dispatch(setJobs(jobs));
        dispatch(setLoading(false));
      })
      .catch(() => {
        dispatch(setLoading(false));
      });
  }, [dispatch]);

  /**
   * Opens the job named in the URL.
   *
   * `?job=<id>` is what makes a job addressable at all — without it every
   * share, bookmark and back-button press lands on the list rather than on the
   * posting someone meant to send. Runs once the list is in, since selection is
   * validated against it.
   *
   * A stale or filtered-out id is left alone rather than forced: the
   * auto-select below then does the ordinary thing.
   */
  const deepLinked = useRef(false);
  useEffect(() => {
    if (deepLinked.current || !hasJobs || isLoading) return;
    const wanted = searchParams.get("job");
    if (wanted && filteredJobs.some((j) => j.id === wanted)) {
      dispatch(setSelectedJobId(wanted));
    }
    // Arrived from a recommendation digest: record the open, then drop the tag
    // so it doesn't ride along onto the next job selected, or a reload.
    if (searchParams.get("src")) {
      if (wanted && searchParams.get("src") === "rec") reportRecommendationOpened(wanted);
      const next = new URLSearchParams(searchParams);
      next.delete("src");
      setSearchParams(next, { replace: true });
    }
    deepLinked.current = true;
  }, [hasJobs, isLoading, filteredJobs, searchParams, setSearchParams, dispatch]);

  // Desktop: auto-select first job once loaded
  useEffect(() => {
    if (isMobile || !hasJobs || isLoading) return;
    const isSelectedJobAvailable = filteredJobs.some((j) => j.id === selectedJobId);
    if (!selectedJobId || !isSelectedJobAvailable) {
      dispatch(setSelectedJobId(filteredJobs[0].id));
    }
  }, [filteredJobs, selectedJobId, isMobile, dispatch, hasJobs, isLoading]);

  /**
   * Mirrors the selection back into the URL.
   *
   * `replace` so browsing the list does not fill the history stack with one
   * entry per job — the back button should leave the page, not step through
   * every posting glanced at on the way.
   */
  useEffect(() => {
    if (!deepLinked.current) return;
    const current = searchParams.get("job");
    if (selectedJobId === current && !searchParams.has("src")) return;
    const next = new URLSearchParams(searchParams);
    // The arrival tag was read by the deep-link effect above; it must not
    // survive onto whatever job is selected next.
    next.delete("src");
    if (selectedJobId) next.set("job", selectedJobId);
    else next.delete("job");
    setSearchParams(next, { replace: true });
  }, [selectedJobId, searchParams, setSearchParams]);

  // Clear selection when switching from desktop to mobile
  useEffect(() => {
    const switchedToMobile = isMobile && !prevIsMobileRef.current;
    if (switchedToMobile && selectedJobId) {
      dispatch(setSelectedJobId(null));
    }
    prevIsMobileRef.current = isMobile;
  }, [isMobile, selectedJobId, dispatch]);

  // Mobile: lock body scroll when viewing job details
  useEffect(() => {
    if (!isMobile) return;
    document.body.style.overflow = showMobileDetails ? "hidden" : "unset";
    return () => { document.body.style.overflow = "unset"; };
  }, [showMobileDetails, isMobile]);

  // Mobile: restore scroll position when returning to list
  useEffect(() => {
    if (!isMobile || showMobileDetails || !mobileScrollPosition) return;
    requestAnimationFrame(() => window.scrollTo(0, mobileScrollPosition));
  }, [showMobileDetails, mobileScrollPosition, isMobile]);

  const handleSelectJob = (jobId: string) => {
    if (isMobile) dispatch(setMobileScrollPosition(window.scrollY));
    dispatch(setSelectedJobId(jobId));
  };

  const handleBackToListings = () => dispatch(setSelectedJobId(null));

  /**
   * Opens a job from "Picked for you". A filter the seeker set can hide it
   * from the list, in which case the filters give way — they asked to see it.
   */
  const handleRecommendedSelect = (jobId: string) => {
    reportRecommendationOpened(jobId);
    if (filteredJobs.some((j) => j.id === jobId)) {
      handleSelectJob(jobId);
    } else if (allJobs.some((j) => j.id === jobId)) {
      dispatch(resetFilters());
      handleSelectJob(jobId);
    } else {
      toast("That job isn't in the list yet — try refreshing.");
    }
  };

  const renderSkeletons = () => (
    <div className="space-y-3">
      {[...Array(SKELETON_COUNT)].map((_, i) => (
        <div
          key={i}
          className="animate-in fade-in slide-in-from-bottom-2 duration-300"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <JobCardSkeleton />
        </div>
      ))}
    </div>
  );

  const renderJobList = (showSelectedHighlight: boolean) => (
    <div className="animate-in fade-in duration-300">
      <div className="mb-3">
        <RecommendedJobs onSelect={handleRecommendedSelect} />
      </div>
      <div className="space-y-3">
        {filteredJobs.map((job, index) => (
          <div
            key={job.id}
            className="animate-in fade-in slide-in-from-bottom-2 duration-300"
            style={{ animationDelay: `${index * 40}ms` }}
          >
            <JobCard
              job={job}
              match={matches[job.id]}
              isSelected={showSelectedHighlight && currentJob?.id === job.id}
              onClick={() => handleSelectJob(job.id)}
            />
            {index === 0 && (
              <div className="mt-3">
                <EmailAlertCard />
              </div>
            )}
          </div>
        ))}
      </div>
      <JobListingsFooter />
    </div>
  );

  return (
    <>
      <FilterDrawer />
      <SearchBar />

      <div className="container mx-auto px-4 md:px-12 lg:px-24 py-4">

        {/* Desktop & Tablet: Split view */}
        <div className="hidden md:grid grid-cols-12 gap-4 xl:gap-5">

          {/* Job List Column */}
          <div className="col-span-5 xl:col-span-4">
            {isLoading
              ? renderSkeletons()
              : hasJobs
              ? renderJobList(true)
              : <EmptyState />}
          </div>

          {/* Job Details Column */}
          <div className="col-span-7 xl:col-span-8">
            <div className="sticky top-20">
              {isLoading ? (
                <JobDetailsSkeleton />
              ) : currentJob ? (
                <JobDetails key={currentJob.id} job={currentJob} />
              ) : (
                <EmptyState />
              )}
            </div>
          </div>
        </div>

        {/* Mobile: Toggle between list and detail */}
        <div className="md:hidden">
          {!showMobileDetails ? (
            isLoading
              ? renderSkeletons()
              : hasJobs
              ? renderJobList(false)
              : <EmptyState />
          ) : (
            <div className="fixed inset-0 top-16 z-40 bg-background flex flex-col border-t border-border">
              {/* Back Header */}
              <div className="flex-shrink-0 border-b px-4 py-3 bg-card border-border pt-[calc(env(safe-area-inset-top)+0.75rem)]">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBackToListings}
                  className="-ml-2"
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              </div>

              {/* Scrollable Detail */}
              <div
                ref={mobileDetailRef}
                className="flex-1 overflow-y-auto overflow-x-hidden"
              >
                {currentJob ? (
                  <JobDetails
                    key={currentJob.id}
                    job={currentJob}
                    isMobile
                    scrollContainerRef={mobileDetailRef}
                  />
                ) : (
                  <EmptyState />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default JobListings;