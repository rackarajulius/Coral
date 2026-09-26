import { useState } from "react";
import type { Job } from "@/data/admin/job/jobs";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { StatusBadge, RiskBadge } from "./JobBadges";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  MapPin,
  DollarSign,
  Briefcase,
  Calendar,
  Users,
  AlertTriangle,
  Shield,
  Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  job: Job | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateStatus?: (jobId: string, status: Job["status"]) => void;
  onDelete?: (jobId: string) => void;
  onUndoDelete?: (job: Job) => void;
}

function StatBlock({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function formatSalary(job: Job) {
  if (!job.salaryMin) return "Not specified";
  if (job.salaryUnit) return `${job.currency ?? "$"}${job.salaryMin}${job.salaryUnit}`;
  if (job.salaryMax && job.salaryMax !== job.salaryMin)
    return `${job.currency ?? "$"}${job.salaryMin.toLocaleString()} – ${job.currency ?? "$"}${job.salaryMax.toLocaleString()}`;
  return `${job.currency ?? "$"}${job.salaryMin.toLocaleString()}`;
}

export function JobDetailDrawer({ job, open, onOpenChange, onUpdateStatus, onDelete, onUndoDelete }: Props) {
  const [confirmAction, setConfirmAction] = useState<"reject" | "delete" | null>(null);
  const { toast } = useToast();

  if (!job) return null;

  const timeline = job.timeline ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
         className="w-full sm:max-w-lg p-0 overflow-y-auto"
      >
        {/* Header */}
        <SheetHeader className="px-6 py-5 pt-6 pb-4  border-b border-border shrink-0">
          <div className="flex items-start gap-4">
            {/* Company logo */}
            <div className="h-12 w-12 rounded-xl bg-secondary flex items-center justify-center text-lg font-bold text-muted-foreground shrink-0">
              {job.companyLogo ? (
                <img src={job.companyLogo} alt={job.company} className="h-full w-full object-cover rounded-xl" />
              ) : (
                job.company.charAt(0)
              )}
            </div>

            <div className="flex-1 min-w-0">
              <SheetTitle className="text-lg font-semibold text-foreground leading-tight">
                {job.title}
              </SheetTitle>
              <p className="text-sm text-muted-foreground mt-0.5">{job.company}</p>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-mono bg-secondary px-2 py-0.5 rounded mt-1.5">
                <Copy className="h-3 w-3" />
                {job.id}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <StatusBadge status={job.status} />
              <RiskBadge risk={job.risk} />
            </div>
          </div>
        </SheetHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto divide-y divide-border">

          {/* Job Overview */}
          <div className="px-6 py-5 space-y-4">
            <p className="text-sm font-semibold text-foreground">Job Overview</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" />
                <span>{job.location}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Briefcase className="h-4 w-4 shrink-0" />
                <span>{job.type}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <DollarSign className="h-4 w-4 shrink-0" />
                <span>{formatSalary(job)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4 shrink-0" />
                <span>{job.applications} applications</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4 shrink-0" />
                <span>
                  Posted{" "}
                  {new Date(job.postedDate).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
              {job.expiryDate && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4 shrink-0" />
                  <span>
                    Expires{" "}
                    {new Date(job.expiryDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          {(job.description || (job.responsibilities?.length ?? 0) > 0 || (job.requirements?.length ?? 0) > 0 || (job.benefits?.length ?? 0) > 0) && (
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm font-semibold text-foreground">Description</p>

              {job.description && (
                <p className="text-sm text-muted-foreground leading-relaxed">{job.description}</p>
              )}

              {(job.responsibilities?.length ?? 0) > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Responsibilities</p>
                  <ul className="space-y-1">
                    {job.responsibilities!.map((r, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex gap-2">
                        <span className="text-accent mt-1 shrink-0">•</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(job.requirements?.length ?? 0) > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Requirements</p>
                  <ul className="space-y-1">
                    {job.requirements!.map((r, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex gap-2">
                        <span className="text-accent mt-1 shrink-0">•</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(job.benefits?.length ?? 0) > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Benefits</p>
                  <ul className="space-y-1">
                    {job.benefits!.map((b, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex gap-2">
                        <span className="text-accent mt-1 shrink-0">•</span>
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Moderation */}
          <div className="px-6 py-5 space-y-3">
            <p className="text-sm font-semibold text-foreground">Moderation</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="default" size="sm" className="h-8 text-xs" onClick={() => { const prev = job.status; onUpdateStatus?.(job.id, "Active"); toast({ title: "Job Approved", description: `"${job.title}" is now active.`, duration: 8000, action: <ToastAction altText="Undo" onClick={() => { onUpdateStatus?.(job.id, prev); toast({ title: "Undo successful", description: `"${job.title}" reverted to ${prev}.` }); }}>Undo</ToastAction> }); }}>
                Approve
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { const prev = job.status; onUpdateStatus?.(job.id, "Expired"); toast({ title: "Job Suspended", description: `"${job.title}" has been suspended.`, duration: 8000, action: <ToastAction altText="Undo" onClick={() => { onUpdateStatus?.(job.id, prev); toast({ title: "Undo successful", description: `"${job.title}" reverted to ${prev}.` }); }}>Undo</ToastAction> }); }}>
                Suspend
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { const prev = job.status; onUpdateStatus?.(job.id, "Flagged"); toast({ title: "Job Flagged", description: `"${job.title}" has been flagged.`, variant: "destructive", duration: 8000, action: <ToastAction altText="Undo" onClick={() => { onUpdateStatus?.(job.id, prev); toast({ title: "Undo successful", description: `"${job.title}" reverted to ${prev}.` }); }}>Undo</ToastAction> }); }}>
                Flag
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs">
                Edit
              </Button>
            </div>
            <div className="flex gap-2 pt-1 ">
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={() => setConfirmAction("reject")}
              >
                Reject
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="h-8 text-xs"
                onClick={() => setConfirmAction("delete")}
              >
                Delete
              </Button>
            </div>
          </div>

          <AlertDialog open={confirmAction !== null} onOpenChange={(v) => !v && setConfirmAction(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {confirmAction === "delete" ? "Delete this job?" : "Reject this job?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {confirmAction === "delete"
                    ? "This will permanently remove the job listing. This action cannot be undone."
                    : "This will reject the job listing and it will no longer be visible to applicants."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
               <AlertDialogAction
  className={cn(
    confirmAction === "delete"
      ? "bg-rose-500 text-white hover:bg-rose-500/90"
      : "bg-amber-500 text-white hover:bg-amber-500/90"
  )}
  onClick={() => {
    const prevStatus = job.status;
    const jobSnapshot = { ...job };

    if (confirmAction === "delete") {
      onDelete?.(job.id);

      toast({
        title: "Job Deleted",
        description: `"${job.title}" has been removed.`,
        variant: "destructive",
        duration: 8000,
        action: (
          <ToastAction
            altText="Undo"
            onClick={() => {
              onUndoDelete?.(jobSnapshot);
              toast({
                title: "Undo successful",
                description: `"${job.title}" has been restored.`,
              });
            }}
          >
            Undo
          </ToastAction>
        ),
      });
    } else {
      onUpdateStatus?.(job.id, "Rejected");

      toast({
        title: "Job Rejected",
        description: `"${job.title}" has been rejected.`,
        variant: "destructive",
        duration: 8000,
        action: (
          <ToastAction
            altText="Undo"
            onClick={() => {
              onUpdateStatus?.(job.id, prevStatus);
              toast({
                title: "Undo successful",
                description: `"${job.title}" reverted to ${prevStatus}.`,
              });
            }}
          >
            Undo
          </ToastAction>
        ),
      });
    }

    setConfirmAction(null);
  }}
>
  {confirmAction === "delete" ? "Delete" : "Reject"}
</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Risk & Reports */}
          <div className="px-6 py-5 space-y-3">
            <p className="text-sm font-semibold text-foreground">Risk & Reports</p>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="h-4 w-4" />
                <span>Risk Level</span>
              </div>
              <RiskBadge risk={job.risk} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-secondary rounded-lg p-3 flex items-start justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span className="text-xs">Duplicate Detection</span>
                </div>
                <span className={cn(
                  "text-xs font-medium",
                  job.duplicateDetected ? "text-[hsl(var(--status-flagged))]" : "text-[hsl(var(--status-active))]"
                )}>
                  {job.duplicateDetected ? "Detected" : "Clear"}
                </span>
              </div>
              <div className="bg-secondary rounded-lg p-3 flex items-start justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span className="text-xs">Spam Keywords</span>
                </div>
                <span className={cn(
                  "text-xs font-medium",
                  job.spamKeywords ? "text-[hsl(var(--status-flagged))]" : "text-[hsl(var(--status-active))]"
                )}>
                  {job.spamKeywords ? "Detected" : "Clear"}
                </span>
              </div>
            </div>
          </div>

          {/* Activity Timeline */}
          {timeline.length > 0 && (
            <div className="px-6 py-5 space-y-3">
              <p className="text-sm font-semibold text-foreground">Activity Timeline</p>
              <div className="space-y-0">
                {timeline.map((event, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="h-2 w-2 rounded-full bg-accent mt-1.5 shrink-0" />
                      {i < timeline.length - 1 && (
                        <div className="w-px flex-1 bg-border mt-1" style={{ minHeight: "20px" }} />
                      )}
                    </div>
                    <div className="flex-1 flex justify-between items-start pb-3">
                      <div>
                        <p className="text-sm text-foreground">{event.action}</p>
                        {event.by && (
                          <p className="text-xs text-muted-foreground">by {event.by}</p>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                        {new Date(event.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </SheetContent>
    </Sheet>
  );
}
