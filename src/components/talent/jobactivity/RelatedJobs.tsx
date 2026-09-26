import { Briefcase, MapPin } from 'lucide-react';
import { RELATED_JOBS } from '@/data/jobactivity/job-activity-mock';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import CompanyMark from './CompanyMark';

const RelatedJobs = () => {
  return (
    <Carousel opts={{ align: 'start', watchDrag: false }} className="w-full">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h4 className="text-sm font-semibold text-foreground">Related Jobs</h4>
        <div className="flex gap-2">
          <CarouselPrevious className="static translate-y-0 h-8 w-8" />
          <CarouselNext className="static translate-y-0 h-8 w-8" />
        </div>
      </div>
      <CarouselContent className="-ml-3">
        {RELATED_JOBS.map((job) => (
          <CarouselItem key={job.id} className="pl-3 basis-4/5 sm:basis-1/2">
            <div className="h-full rounded-xl border border-gray-300 bg-white p-4 transition-shadow duration-300 hover:shadow-md">
              <div className="flex items-start gap-3 mb-3">
                <CompanyMark letter={job.company[0]} seed={job.company} />
                <div className="min-w-0">
                  <h5 className="font-semibold text-sm text-foreground truncate">{job.title}</h5>
                  <p className="text-xs text-muted-foreground truncate">{job.company}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mb-3">
                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {job.location}</span>
                <span className="flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" /> {job.type}</span>
              </div>
              <span className="text-xs font-medium text-[#F97316]">{job.match}% match</span>
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );
};

export default RelatedJobs;
