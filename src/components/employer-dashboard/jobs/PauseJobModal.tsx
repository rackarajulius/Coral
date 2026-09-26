import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { CalendarClock, Pause, UserCheck, Users } from "lucide-react";
import JobStat from "./JobStat";
import { Job, useJobsStore } from "@/stores/jobsStore";
import { toast } from "sonner";

interface PauseJobModalProps {
  job: Job | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PauseJobModal({ job, open, onOpenChange }: PauseJobModalProps) {
  const pauseJobs = useJobsStore((s) => s.pauseJobs);
  const [notify, setNotify] = useState(false);

  if (!job) return null;

  const handlePause = async () => {
    try {
      await pauseJobs([job.id]);
      toast.success("Job paused.", {
        description: notify ? "Candidates in progress will be notified." : undefined,
      });
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pause className="h-5 w-5 text-amber-600" />
            Pause job posting?
          </DialogTitle>
          <DialogDescription>
            Pausing stops new applications while keeping your pipeline and reporting data intact.
            You can reopen the job anytime.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border bg-secondary/40 p-3 space-y-2 text-sm">
          <p className="font-medium text-foreground">{job.title}</p>
          <div className="grid grid-cols-3 gap-2 pt-1">
            <JobStat icon={<Users className="h-3.5 w-3.5" />} label="Applicants" value={job.applicants} />
            <JobStat icon={<UserCheck className="h-3.5 w-3.5" />} label="Active" value={job.activeCandidates} />
            <JobStat icon={<CalendarClock className="h-3.5 w-3.5" />} label="Interviews" value={job.openInterviews} />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
          <Label htmlFor="pause-notify" className="text-sm cursor-pointer">
            Notify active candidates
          </Label>
          <Switch id="pause-notify" checked={notify} onCheckedChange={setNotify} />
        </div>

        <DialogFooter>
          <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handlePause}
          >
            Pause Job
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
