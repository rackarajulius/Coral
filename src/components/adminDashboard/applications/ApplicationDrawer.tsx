import { useState } from "react";
import { Download, Mail, Trash2, Flag, FileText, Clock, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Application } from "@/data/admin/applications/applications";
import { StatusBadge, RiskBadge, ScreeningScoreBar } from "./StatusBadge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

type DestructiveAction = "flag" | "reject" | "delete" | null;

interface ApplicationDrawerProps {
  application: Application | null;
  open: boolean;
  onClose: () => void;
  onAction?: (type: "flag" | "reject" | "delete", app: Application) => void;
}

const actionConfig = {
  flag: {
    title: "Flag this application?",
    description: "This will flag the application for review by the moderation team. The applicant will not be notified immediately.",
    confirm: "Flag Application",
    onSuccess: "Application flagged for review",
  },
  reject: {
    title: "Reject this application?",
    description: "This will mark the application as rejected. The applicant may be notified depending on employer settings. This action can be reversed.",
    confirm: "Reject Application",
    onSuccess: "Application rejected",
  },
  delete: {
    title: "Delete this application?",
    description: "This will permanently remove this application and all associated data including screening answers and timeline history. This action cannot be undone.",
    confirm: "Delete Application",
    onSuccess: "Application deleted",
  },
};

export function ApplicationDrawer({ application, open, onClose, onAction }: ApplicationDrawerProps) {
  const [pendingAction, setPendingAction] = useState<DestructiveAction>(null);

  if (!application) return null;

  const { applicant, job } = application;

  const handleConfirm = () => {
    if (pendingAction) {
      if (onAction) {
        onAction(pendingAction, application);
      } else {
        toast.success(actionConfig[pendingAction].onSuccess, {
          description: `${applicant.name} — ${application.id}`,
        });
      }
      setPendingAction(null);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
        <SheetContent side="right" className="w-full max-w-[720px] sm:max-w-[720px] overflow-y-auto scrollbar p-0">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between bg-card border-b border-border px-6 py-4">
            <SheetHeader className="space-y-0.5">
              <SheetTitle className="text-lg font-semibold text-card-foreground">Application Detail</SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">{application.id}</SheetDescription>
            </SheetHeader>
          </div>

          <div className="p-6 space-y-6">
            {/* Section 1: Applicant Overview */}
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Applicant</h3>
              <div className="flex items-start gap-4">
                <Avatar className="h-14 w-14">
                  <AvatarFallback className="bg-primary text-primary-foreground font-semibold">{applicant.avatar}</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <p className="text-base font-semibold text-card-foreground">{applicant.name}</p>
                  <p className="text-sm text-muted-foreground">{applicant.email}</p>
                  <p className="text-sm text-muted-foreground">{applicant.phone}</p>
                  <p className="text-sm text-muted-foreground">{applicant.location}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-muted-foreground">Profile:</span>
                    <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${applicant.profileCompletion}%` }} />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">{applicant.profileCompletion}%</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <StatusBadge status={application.status} />
                  <RiskBadge level={application.riskLevel} reason={application.riskReason} />
                </div>
              </div>
            </section>

            <Separator />

            {/* Section 2: Job Summary */}
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Applied Job</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Title:</span> <span className="font-medium text-card-foreground">{job.title}</span></div>
                <div><span className="text-muted-foreground">Employer:</span> <span className="font-medium text-card-foreground">{job.employer}</span></div>
                <div><span className="text-muted-foreground">Salary:</span> <span className="font-medium text-card-foreground">{job.salary}</span></div>
                <div><span className="text-muted-foreground">Type:</span> <span className="font-medium text-card-foreground">{job.type}</span></div>
                <div><span className="text-muted-foreground">Location:</span> <span className="font-medium text-card-foreground">{job.location}</span></div>
                <div><span className="text-muted-foreground">Posted:</span> <span className="font-medium text-card-foreground">{job.postedDate}</span></div>
              </div>
            </section>

            <Separator />

            {/* Section 3: Resume & Cover Letter */}
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Resume & Cover Letter</h3>
              {application.resume ? (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary border border-border">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-card-foreground">resume_{applicant.name.toLowerCase().replace(" ", "_")}.pdf</p>
                    <p className="text-xs text-muted-foreground">Uploaded {application.appliedDate}</p>
                  </div>
                  <Button variant="ghost" size="sm"><Download className="h-4 w-4" /></Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No resume uploaded</p>
              )}
              {application.coverLetter ? (
                <div className="mt-3 p-3 rounded-lg bg-secondary border border-border max-h-32 overflow-y-auto scrollbar">
                  <p className="text-sm text-card-foreground leading-relaxed">{application.coverLetter}</p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground italic">No cover letter provided</p>
              )}
            </section>

            <Separator />

            {/* Section 4: Screening Questions */}
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Screening Questions</h3>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-sm text-muted-foreground">Score:</span>
                <ScreeningScoreBar score={application.screeningScore} />
              </div>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-secondary">
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Question</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Answer</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {application.screeningQuestions.map((q, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-3 py-2 text-card-foreground">{q.question}</td>
                        <td className="px-3 py-2 text-card-foreground">{q.answer}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={cn(
                            "inline-flex h-5 w-5 items-center justify-center rounded-full text-xs",
                            q.passed ? "bg-status-shortlisted/10 text-status-shortlisted" : "bg-status-rejected/10 text-status-rejected"
                          )}>
                            {q.passed ? "✓" : "✗"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <Separator />

            {/* Section 5: Activity Timeline */}
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Activity Timeline</h3>
              <div className="space-y-0">
                {application.timeline.map((event, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="h-2 w-2 rounded-full bg-accent mt-1.5" />
                      {i < application.timeline.length - 1 && <div className="w-px flex-1 bg-border" />}
                    </div>
                    <div className="pb-4">
                      <p className="text-sm font-medium text-card-foreground">{event.event}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {event.date}
                        {event.actor && <span>• {event.actor}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <Separator />

            {/* Section 6: Moderation Panel */}
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Admin Actions</h3>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" className="justify-start gap-2" onClick={() => toast.success("Email draft opened", { description: `To: ${applicant.email}` })}>
                  <Mail className="h-4 w-4" /> Email Applicant
                </Button>
                <Button variant="outline" size="sm" className="justify-start gap-2" onClick={() => setPendingAction("flag")}>
                  <Flag className="h-4 w-4" /> Flag Application
                </Button>
                <Button variant="outline" size="sm" className="justify-start gap-2" onClick={() => setPendingAction("reject")}>
                  <XCircle className="h-4 w-4" /> Reject Application
                </Button>
              </div>
              <div className="mt-4 p-3 rounded-lg border border-destructive/20 bg-destructive/5">
                <p className="text-xs font-medium text-destructive mb-2">Danger Zone</p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={() => setPendingAction("delete")}
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Delete Application
                  </Button>
                </div>
              </div>
            </section>
          </div>
        </SheetContent>
      </Sheet>

      {/* Confirmation Dialog */}
      {pendingAction && (
        <AlertDialog open={!!pendingAction} onOpenChange={v => { if (!v) setPendingAction(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{actionConfig[pendingAction].title}</AlertDialogTitle>
              <AlertDialogDescription>{actionConfig[pendingAction].description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleConfirm}
              >
                {actionConfig[pendingAction].confirm}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
