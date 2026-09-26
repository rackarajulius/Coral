import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Users, CalendarClock, UserCheck } from "lucide-react";
import JobStat from "./JobStat";
import { Job, useJobsStore } from "@/stores/jobsStore";
import { toast } from "sonner";

interface Props {
  jobs: Job[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const REASONS = ["Position filled", "Hiring paused", "Budget changes", "Duplicate posting", "Other"];

export default function CloseJobModal({ jobs, open, onOpenChange }: Props) {
  const closeJobs = useJobsStore((s) => s.closeJobs);
  const [notify, setNotify] = useState(false);
  const [reason, setReason] = useState<string>("Position filled");

  if (jobs.length === 0) return null;
  const single = jobs.length === 1 ? jobs[0] : null;
  const totalApplicants = jobs.reduce((a, j) => a + j.applicants, 0);
  const totalActive = jobs.reduce((a, j) => a + j.activeCandidates, 0);
  const totalInterviews = jobs.reduce((a, j) => a + j.openInterviews, 0);
  const hasInterviews = totalInterviews > 0;

  const handle = async () => {
    try {
      await closeJobs(jobs.map((j) => j.id), reason);
      toast.success(jobs.length === 1 ? "Job closed successfully." : `${jobs.length} jobs closed.`, {
        description: notify ? "Candidates will be notified." : undefined,
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
          <DialogTitle>Close {jobs.length === 1 ? "Job Posting?" : `${jobs.length} Job Postings?`}</DialogTitle>
          <DialogDescription>
            Closing will stop new applications but preserve all candidate and reporting data.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border bg-secondary/40 p-3 space-y-2 text-sm">
          {single ? (
            <p className="font-medium text-foreground">{single.title}</p>
          ) : (
            <p className="font-medium text-foreground">{jobs.length} selected jobs</p>
          )}
          <div className="grid grid-cols-3 gap-2 pt-1">
            <JobStat icon={<Users className="h-3.5 w-3.5" />} label="Applicants" value={totalApplicants} />
            <JobStat icon={<UserCheck className="h-3.5 w-3.5" />} label="Active" value={totalActive} />
            <JobStat icon={<CalendarClock className="h-3.5 w-3.5" />} label="Interviews" value={totalInterviews} />
          </div>
        </div>

        {hasInterviews && (
          <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{totalInterviews} interview{totalInterviews === 1 ? " is" : "s are"} still scheduled. Review your pipeline before closing.</span>
          </div>
        )}

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Reason for closing</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <Label htmlFor="notify" className="text-sm cursor-pointer">Notify candidates of closure</Label>
            <Switch id="notify" checked={notify} onCheckedChange={setNotify} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={handle}>Close Job{jobs.length > 1 ? "s" : ""}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
