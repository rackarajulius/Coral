import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Job, useJobsStore } from "@/stores/jobsStore";
import { CheckCircle2, Send, Archive, XCircle, Trash2, UserCog, Download, X, Loader2, AlertTriangle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import CloseJobModal from "./CloseJobModal";
import DeleteJobsDialog from "./DeleteJobsDialog";
import { toast } from "sonner";

interface Props {
  selectedJobs: Job[];
}

export default function BulkActionsToolbar({ selectedJobs }: Props) {
  const { clearSelection, publishJobs, archiveJobs, assignRecruiter, jobs } = useJobsStore();
  const recruiters = useMemo(
    () => [...new Set(jobs.map((j) => j.recruiter).filter((r): r is string => !!r))].sort(),
    [jobs]
  );
  const [closeOpen, setCloseOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [progress, setProgress] = useState<{ total: number; done: number } | null>(null);
  const count = selectedJobs.length;
  const interviewWarn = selectedJobs.filter((j) => j.openInterviews > 0).length;

  useEffect(() => {
    if (!progress) return;
    if (progress.done >= progress.total) {
      const t = setTimeout(() => setProgress(null), 800);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setProgress((p) => p && { ...p, done: p.done + 1 }), 60);
    return () => clearTimeout(t);
  }, [progress]);

  if (count === 0) return null;

  const runWithProgress = (fn: () => Promise<void>, label: string) => {
    setProgress({ total: count, done: 0 });
    const minDelay = new Promise<void>((resolve) => setTimeout(resolve, count * 60 + 100));
    Promise.all([fn(), minDelay])
      .then(() => {
        toast.success(`${label} ${count} job${count === 1 ? "" : "s"}.`);
      })
      .catch((e) => {
        setProgress(null);
        toast.error((e as Error).message);
      });
  };

  const exportCsv = () => {
    const rows = [
      ["Title", "Status", "Department", "Location", "Applicants", "Posted"],
      ...selectedJobs.map((j) => [j.title, j.status, j.department, j.location, String(j.applicants), j.posted]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jobs-export-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${count} job${count === 1 ? "" : "s"} as CSV.`);
  };

  return (
    <>
      <div className="sticky top-2 z-30 flex flex-wrap items-center gap-2 rounded-xl border border-gray-300 bg-card px-3 py-2">
        <div className="flex items-center gap-2 pr-2 border-r border-gray-300">
          <span className="inline-flex items-center justify-center h-6 min-w-6 rounded-full bg-orange-500/90 px-1.5 text-xs font-medium text-primary-foreground">{count}</span>
          <span className="text-sm text-foreground">selected</span>
        </div>

        {progress && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Processing {progress.done} of {progress.total}…
          </div>
        )}

        {!progress && interviewWarn > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {interviewWarn} job{interviewWarn === 1 ? "" : "s"} with open interviews
          </div>
        )}



        <div className="ml-auto flex flex-wrap items-center gap-1">
          <Button size="sm" variant="outline" onClick={() => runWithProgress(() => publishJobs(selectedJobs.map((j) => j.id)), "Published")}>
            <Send className="h-3.5 w-3.5 mr-1.5" /> Publish
          </Button>
          <Button size="sm" variant="outline" onClick={() => setCloseOpen(true)}>
            <XCircle className="h-3.5 w-3.5 mr-1.5" /> Close
          </Button>
          <Button size="sm" variant="outline" onClick={() => runWithProgress(() => archiveJobs(selectedJobs.map((j) => j.id)), "Archived")}>
            <Archive className="h-3.5 w-3.5 mr-1.5" /> Archive
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline"><UserCog className="h-3.5 w-3.5 mr-1.5" /> Assign</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {recruiters.map((r) => (
                <DropdownMenuItem key={r} onClick={() => { assignRecruiter(selectedJobs.map((j) => j.id), r); toast.success(`Assigned ${r} to ${count} jobs.`); }}>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-2 text-muted-foreground" /> {r}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" variant="default" onClick={exportCsv}>
            <Download className="h-3.5 w-3.5 mr-1.5" /> Export
          </Button>
          <Button size="sm" variant="destructive" className="text-white" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
          </Button>
          <Button size="sm" variant="outline" onClick={clearSelection} className="text-muted-foreground">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <CloseJobModal jobs={selectedJobs} open={closeOpen} onOpenChange={setCloseOpen} />
      <DeleteJobsDialog jobs={selectedJobs} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </>
  );
}
