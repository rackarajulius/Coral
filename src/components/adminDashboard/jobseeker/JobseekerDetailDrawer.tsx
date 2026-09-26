import {
  X,
  MapPin,
  Mail,
  Phone,
  Calendar,
  Clock,
  Briefcase,
  Bookmark,
  FileText,
  ShieldOff,
  ShieldCheck,
  Trash2,
  Bell,
  RefreshCw,
  AlertTriangle,
  Star,
  BadgeCheck,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { toastWithUndo } from "@/lib/toast-Undo";
import { cn } from "@/lib/utils";
import { Jobseeker } from "@/data/admin/jobseeker/jobs-data";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ConfirmModal, ConfirmModalVariant } from "@/components/ui/ConfirmModal";
import { JobseekerPremiumPanel } from "./JobseekerPremiumPanel";

interface JobseekerDetailDrawerProps {
  jobseeker: Jobseeker | null;
  open: boolean;
  onClose: () => void;
}
const statusStyles: Record<string, string> = {
  Active:
    "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400",

  Inactive:
    "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400",

  Suspended:
    "bg-rose-500/10 text-rose-600 border border-rose-500/20 dark:bg-rose-500/20 dark:text-rose-400",

  Flagged:
    "bg-amber-500/10 text-amber-600 border border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400",

  Deleted:
    "bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400",
};

const appStatusStyles: Record<string, string> = {
  Applied:
    "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400",

  Interview:
    "bg-blue-500/10 text-blue-600 border border-blue-500/20 dark:bg-blue-500/20 dark:text-blue-400",

  Offer:
    "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400",

  Rejected:
    "bg-rose-500/10 text-rose-600 border border-rose-500/20 dark:bg-rose-500/20 dark:text-rose-400",
};


export function JobseekerDetailDrawer({ jobseeker, open, onClose }: JobseekerDetailDrawerProps) {
  const [modal, setModal] = useState<ConfirmModalVariant | null>(null);

  if (!jobseeker) return null;

  return (
    <>
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto p-0 sm:max-w-[720px]"
      >
        {/* Header */}
        <SheetHeader className="border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base font-semibold">Jobseeker Profile</SheetTitle>
          </div>
        </SheetHeader>

        <div className="space-y-0 divide-y divide-border">
          {/* ── Section 1: Profile Overview ── */}
          <section className="px-6 py-6">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-secondary text-lg font-semibold text-foreground overflow-hidden">
                {jobseeker.avatar.startsWith('http') ? (
                  <img
                    src={jobseeker.avatar}
                    alt={`${jobseeker.name} avatar`}
                    className="h-full w-full object-cover rounded-full"
                    onError={(e) => {
                      // Fallback to initials if image fails to load
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        parent.textContent = (jobseeker.name || jobseeker.email).substring(0, 2).toUpperCase();
                      }
                    }}
                  />
                ) : (
                  jobseeker.avatar
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold text-foreground">{jobseeker.name}</h2>
                  {jobseeker.isPremium && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-status-pending-bg px-2 py-0.5 text-xs font-medium text-status-pending">
                      <Star className="h-3 w-3" /> Premium
                    </span>
                  )}
                  {jobseeker.isVerified && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-status-active-bg px-2 py-0.5 text-xs font-medium text-status-active">
                      <BadgeCheck className="h-3 w-3" /> Verified
                    </span>
                  )}
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                      statusStyles[jobseeker.status]
                    )}
                  >
                    {jobseeker.status}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{jobseeker.email}</span>
                  </div>
                  {jobseeker.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      {jobseeker.phone}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    {jobseeker.location}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    Joined {new Date(jobseeker.signupDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    Last active {new Date(jobseeker.lastActive).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="text-xs text-muted-foreground/60">ID:</span>
                    <span className="font-mono text-xs">{jobseeker.id}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── Section 2: Activity Summary ── */}
          <section className="px-6 py-5">
            <h3 className="mb-4 text-sm font-semibold text-foreground">Activity Summary</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Applications", value: jobseeker.applications, icon: Briefcase },
                { label: "Interviews", value: jobseeker.interviews ?? 0, icon: Calendar },
                { label: "Saved Jobs", value: jobseeker.savedJobs, icon: Bookmark },
                { label: "Resume Uploads", value: jobseeker.resumeUploads ?? 0, icon: FileText },
              ].map((stat) => (
                <div key={stat.label} className="rounded-lg bg-secondary/50 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <stat.icon className="h-3.5 w-3.5 text-muted-foreground/60" />
                    <span className="text-xs text-muted-foreground">{stat.label}</span>
                  </div>
                  <p className="text-2xl font-semibold text-foreground">{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Profile Completion */}
            <div className="mt-4 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Profile Completion</span>
                <span className="font-medium text-foreground">{jobseeker.profileCompletion}%</span>
              </div>
              <Progress value={jobseeker.profileCompletion} className="h-2" />
            </div>
          </section>

          {/* ── Section 3: Application History ── */}
          {jobseeker.applicationHistory && jobseeker.applicationHistory.length > 0 && (
            <section className="px-6 py-5">
              <h3 className="mb-4 text-sm font-semibold text-foreground">Application History</h3>
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Job</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Company</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Status</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobseeker.applicationHistory.map((app, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                        <td className="px-4 py-2.5 font-medium text-foreground">{app.job}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{app.company}</td>
                        <td className="px-4 py-2.5">
                          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", appStatusStyles[app.status] ?? "bg-muted text-muted-foreground")}>
                            {app.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground text-xs">
                          {new Date(app.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ── Section 4: Resume & Documents ── */}
          <section className="px-6 py-5">
            <h3 className="mb-4 text-sm font-semibold text-foreground">Resume & Documents</h3>
            {(jobseeker.resumeUploads ?? 0) > 0 ? (
              <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-4 py-3">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">resume_{jobseeker.name.replace(" ", "_").toLowerCase()}.pdf</p>
                    <p className="text-xs text-muted-foreground">Latest upload</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="h-8 text-xs">Download</Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No resume uploaded.</p>
            )}
          </section>

          {/* ── Section 5: Risk & Reports ── */}
          <section className="px-6 py-5">
            <h3 className="mb-4 text-sm font-semibold text-foreground">Risk & Reports</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Reports Received</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{jobseeker.reportsReceived ?? 0}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Suspicious Flags</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{jobseeker.suspiciousFlags ?? 0}</p>
              </div>
              <div className="rounded-lg border border-border p-3 col-span-2 sm:col-span-1">
                <p className="text-xs text-muted-foreground">Risk Score</p>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <p className="text-2xl font-semibold text-foreground">{jobseeker.riskScore}</p>
                  <span className="text-xs text-muted-foreground">/100</span>
                </div>
                <div className="mt-1.5">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-xs font-medium",
                      jobseeker.risk === "Low" && "text-status-active",
                      jobseeker.risk === "Medium" && "text-status-pending",
                      jobseeker.risk === "High" && "text-status-rejected",
                    )}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full",
                      jobseeker.risk === "Low" && "bg-status-active",
                      jobseeker.risk === "Medium" && "bg-status-pending",
                      jobseeker.risk === "High" && "bg-status-rejected",
                    )} />
                    {jobseeker.risk} Risk
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* ── Premium: paid plan, comp, and the controls to give or end a comp ── */}
          <JobseekerPremiumPanel key={jobseeker.id} userId={jobseeker.id} />

          {/* ── Section 6: Admin Controls ── */}
          <section className="px-6 py-5">
            <h3 className="mb-4 text-sm font-semibold text-foreground">Admin Controls</h3>
            <div className="flex flex-wrap gap-2">
              {jobseeker.status === "Suspended" ? (
                <Button size="sm" variant="default" onClick={() => toastWithUndo(`"${jobseeker.name}" activated`, () => console.log(`Undo: activate ${jobseeker.name}`))}>
                  <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                  Activate Account
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setModal("suspend")}
                >
                  <ShieldOff className="mr-1.5 h-3.5 w-3.5" />
                  Suspend Account
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => toastWithUndo(`Password reset link sent to ${jobseeker.email}`, () => console.log(`Undo: reset password ${jobseeker.email}`))}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Reset Password
              </Button>
              <Button variant="outline" size="sm" onClick={() => toastWithUndo(`Warning sent to "${jobseeker.name}"`, () => console.log(`Undo: warning ${jobseeker.name}`))}>
                <Bell className="mr-1.5 h-3.5 w-3.5" />
                Send Warning
              </Button>
            </div>

            <Separator className="my-4 border-destructive/20" />

            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
              <div className="flex items-start gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-destructive">Danger Zone</p>
                  <p className="text-xs text-muted-foreground mt-0.5">These actions are permanent and cannot be undone.</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-destructive/30 text-destructive hover:bg-destructive/10"
                onClick={() => setModal("delete")}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Delete Account
              </Button>
            </div>
          </section>

          {/* ── Section 7: Activity Timeline ── */}
          {jobseeker.timeline && jobseeker.timeline.length > 0 && (
            <section className="px-6 py-5">
              <h3 className="mb-4 text-sm font-semibold text-foreground">Activity Timeline</h3>
              <div className="relative space-y-0">
                {jobseeker.timeline.map((entry, i) => (
                  <div key={i} className="relative flex gap-4 pb-5 last:pb-0">
                    <div className="flex flex-col items-center">
                      <div className="h-2 w-2 rounded-full bg-accent mt-1.5 shrink-0" />
                      {i < jobseeker.timeline!.length - 1 && (
                        <div className="w-px flex-1 bg-border mt-1.5" />
                      )}
                    </div>
                    <div className="flex flex-1 items-start justify-between pb-0.5">
                      <p className="text-sm text-foreground">{entry.event}</p>
                      <span className="ml-4 shrink-0 text-xs text-muted-foreground">
                        {new Date(entry.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>

    {modal && (
      <ConfirmModal
        open={!!modal}
        variant={modal}
        targetName={jobseeker.name}
        onConfirm={() => setModal(null)}
        onCancel={() => setModal(null)}
      />
    )}
    </>
  );
}

