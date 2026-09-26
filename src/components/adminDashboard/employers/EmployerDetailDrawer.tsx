import { useState } from "react";
import { Employer } from "@/data/admin/employer/employers-data";
import { EmployerStatusBadge } from "./EmployerStatusBadge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
  Globe,
  Mail,
  Phone,
  Briefcase,
  Users,
  AlertTriangle,
  Shield,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { approveEmployer, suspendEmployer, banEmployer, deleteEmployer } from "@/lib/api/adminEmployers";
import { timeAgo } from "@/lib/timeAgo";

interface Props {
  employer: Employer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful action so the parent can refresh the list. */
  onChanged?: () => void;
}

type DestructiveType = "suspend" | "ban" | "delete";

const actionConfig: Record<DestructiveType, { title: string; description: (name: string) => string; confirmLabel: string }> = {
  suspend: {
    title: "Suspend Employer",
    description: (name) => `Are you sure you want to suspend "${name}"? This will temporarily disable their account and all active job listings.`,
    confirmLabel: "Suspend",
  },
  ban: {
    title: "Ban Employer",
    description: (name) => `Are you sure you want to permanently ban "${name}"? This action will remove all their job listings and prevent future access. This cannot be undone.`,
    confirmLabel: "Ban Account",
  },
  delete: {
    title: "Delete Employer",
    description: (name) => `Are you sure you want to permanently delete "${name}"? All associated data, job listings, and applications will be removed. This action cannot be undone.`,
    confirmLabel: "Delete",
  },
};

function StatBlock({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/50 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

export function EmployerDetailDrawer({ employer, open, onOpenChange, onChanged }: Props) {
  const [destructiveAction, setDestructiveAction] = useState<DestructiveType | null>(null);
  const [busy, setBusy] = useState(false);

  if (!employer) return null;

  const handleApprove = async () => {
    setBusy(true);
    try {
      await approveEmployer(employer.id);
      toast.success(`${employer.company} approved`);
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmDestructive = async () => {
    if (!destructiveAction) return;
    const action =
      destructiveAction === "suspend" ? suspendEmployer :
      destructiveAction === "ban" ? banEmployer : deleteEmployer;
    const verb = destructiveAction === "suspend" ? "suspended" : destructiveAction === "ban" ? "banned" : "deleted";
    setBusy(true);
    try {
      await action(employer.id);
      toast.success(`${employer.company} ${verb}`);
      setDestructiveAction(null);
      onChanged?.();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0 bg-card">
          <SheetHeader className="px-6 pt-6 pb-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground text-lg font-bold overflow-hidden shrink-0">
                {employer.logoUrl ? (
                  <img
                    src={employer.logoUrl}
                    alt={employer.company}
                    className="h-full w-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement!.textContent = employer.logo; }}
                  />
                ) : (
                  employer.logo
                )}
              </div>
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-lg font-semibold text-foreground truncate">
                  {employer.company}
                </SheetTitle>
                <div className="mt-1 flex items-center gap-2">
                  <EmployerStatusBadge status={employer.status} />
                  <span className="text-xs text-muted-foreground">{employer.id}</span>
                </div>
              </div>
            </div>
          </SheetHeader>

          <Separator />

          <div className="space-y-6 p-6">
            {/* Company Overview */}
            <section>
              <h3 className="text-sm font-semibold text-foreground mb-3">Company Overview</h3>
              <div className="space-y-2.5 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Briefcase className="h-4 w-4 shrink-0" />
                  <span>{employer.industry}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4 shrink-0" />
                  <span>{employer.companySize ? `${employer.companySize} employees` : 'Size not set'}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Globe className="h-4 w-4 shrink-0" />
                  <span>{employer.location}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <ExternalLink className="h-4 w-4 shrink-0" />
                  {employer.website ? (
                    <a href={employer.website} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline truncate">
                      {employer.website}
                    </a>
                  ) : (
                    <span>No website</span>
                  )}
                </div>
              </div>
            </section>

            <Separator />

            {/* Account Information */}
            <section>
              <h3 className="text-sm font-semibold text-foreground mb-3">Account Information</h3>
              <div className="space-y-2.5 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4 shrink-0" />
                  <a href={`mailto:${employer.email}`} className="text-accent hover:underline truncate">
                    {employer.email}
                  </a>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4 shrink-0" />
                  <span>{employer.phone || 'Not provided'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Plan</span>
                  <span className="font-medium text-foreground">{employer.plan}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Billing</span>
                  <span className="font-medium text-foreground">{employer.billingStatus}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Last Active</span>
                  <span className="font-medium text-foreground">{timeAgo(employer.lastActive)}</span>
                </div>
              </div>
            </section>

            <Separator />

            {/* Job Activity */}
            <section>
              <h3 className="text-sm font-semibold text-foreground mb-3">Job Activity</h3>
              <div className="grid grid-cols-2 gap-3">
                <StatBlock label="Total Posted" value={employer.jobsPosted} />
                <StatBlock label="Active Jobs" value={employer.activeJobs} />
                <StatBlock label="Expired" value={employer.expiredJobs} />
                <StatBlock label="Applications" value={employer.applicationsReceived.toLocaleString()} />
              </div>
            </section>

            <Separator />

            {/* Risk & Flags */}
            <section>
              <h3 className="text-sm font-semibold text-foreground mb-3">Risk & Flags</h3>
              <div className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>Reports</span>
                  </div>
                  <span className="font-medium text-foreground">{employer.reports}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Shield className="h-4 w-4 shrink-0" />
                    <span>Risk Score</span>
                  </div>
                  <span
                    className={
                      employer.riskScore > 50
                         ? "font-medium text-rose-600 dark:text-rose-400"
                               : employer.riskScore > 20
                                ? "font-medium text-amber-600 dark:text-amber-400"
                             : "font-medium text-emerald-600 dark:text-emerald-400"
                    }
                  >
                    {employer.riskScore}/100
                  </span>
                </div>
              </div>
            </section>

            <Separator />

            {/* Actions */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground mb-3">Actions</h3>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="default" className="rounded-full" disabled={busy} onClick={handleApprove}>
                  Approve
                </Button>
              </div>
              <Separator />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full text-warning border-warning/30 hover:bg-warning/10"
                  onClick={() => setDestructiveAction("suspend")}
                >
                  Suspend
                </Button>
                <Button size="sm" variant="destructive" className="rounded-full" onClick={() => setDestructiveAction("ban")}>
                  Ban Account
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => setDestructiveAction("delete")}
                >
                  Delete
                </Button>
              </div>
            </section>
          </div>
        </SheetContent>
      </Sheet>

      {/* Destructive Action Confirmation Modal */}
      <AlertDialog open={!!destructiveAction} onOpenChange={(open) => !open && setDestructiveAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{destructiveAction ? actionConfig[destructiveAction].title : ""}</AlertDialogTitle>
            <AlertDialogDescription>
              {destructiveAction ? actionConfig[destructiveAction].description(employer.company) : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDestructive}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {destructiveAction ? actionConfig[destructiveAction].confirmLabel : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
