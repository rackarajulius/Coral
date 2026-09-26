import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Job, useJobsStore } from "@/stores/jobsStore";
import { toast } from "sonner";

interface Props {
  jobs: Job[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function DeleteJobsDialog({ jobs, open, onOpenChange }: Props) {
  const deleteJobs = useJobsStore((s) => s.deleteJobs);
  const handle = async () => {
    try {
      await deleteJobs(jobs.map((j) => j.id));
      toast.success(`${jobs.length} job${jobs.length === 1 ? "" : "s"} deleted.`);
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {jobs.length} job{jobs.length === 1 ? "" : "s"}?</AlertDialogTitle>
          <AlertDialogDescription>
            This is permanent. All associated candidate pipelines and analytics will be removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handle} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
