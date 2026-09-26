import { useEffect, useRef } from "react";
import { ArrowLeft } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/hooks/useAppDispatch";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  setSelectedJobId,
  setMobileScrollPosition,
  setLoading,
  selectFilteredJobs,
  selectCurrentJob,
} from "@/store/jobsSlice";
import { Button } from "@/components/ui/button";
import JobCard from "./JobCard";
import JobDetails from "./JobDetails";
import JobListingsFooter from "./JobListingsFooter";
import FilterDrawer from "./FilterDrawer";
import EmptyState from "./EmptyState";
import SearchBar from "./SearchBar";
import EmailAlertCard from "./EmailAlertCard";
import JobCardSkeleton from "./JobCardSkeleton";
import JobDetailsSkeleton from "./JobDetailsSkeleton";

const SKELETON_COUNT = 5;
const LOADING_DURATION_MS = 1500;

const JobListings = () => {
  const dispatch = useAppDispatch();
  const isMobile = useIsMobile();

  const selectedJobId = useAppSelector((s) => s.jobs.selectedJobId);
  const mobileScrollPosition = useAppSelector((s) => s.jobs.mobileScrollPosition);
  const filteredJobs = useAppSelector(selectFilteredJobs);
  const currentJob = useAppSelector(selectCurrentJob);
  const isLoading = useAppSelector((state) => state.jobs.isLoading);

  const mobileDetailRef = useRef<HTMLDivElement>(null);
  const prevIsMobileRef = useRef(isMobile);

  const hasJobs = filteredJobs.length > 0;
  const showMobileDetails = isMobile && !!selectedJobId;

  // Simulate async loading on mount
  useEffect(() => {
    dispatch(setLoading(true));
    const timer = setTimeout(() => dispatch(setLoading(false)), LOADING_DURATION_MS);
    return () => clearTimeout(timer);
  }, [dispatch]);

  // Desktop: auto-select first job once loaded
  useEffect(() => {
    if (isMobile || !hasJobs || isLoading) return;
    const isSelectedJobAvailable = filteredJobs.some((j) => j.id === selectedJobId);
    if (!selectedJobId || !isSelectedJobAvailable) {
      dispatch(setSelectedJobId(filteredJobs[0].id));
    }
  }, [filteredJobs, selectedJobId, isMobile, dispatch, hasJobs, isLoading]);

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
      <div className="space-y-3">
        {filteredJobs.map((job, index) => (
          <div
            key={job.id}
            className="animate-in fade-in slide-in-from-bottom-2 duration-300"
            style={{ animationDelay: `${index * 40}ms` }}
          >
            <JobCard
              job={job}
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
        <div className="hidden md:grid grid-cols-12 gap-6 xl:gap-8">

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