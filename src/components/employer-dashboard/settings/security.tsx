import { useEffect, useState } from "react";
import {
  KeyRound, ShieldCheck, Loader2, Eye, EyeOff, LogOut, Link2, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth, type MfaFactor, type MfaEnrolment } from "@/contexts/AuthContext";
import { SectionCard, Field } from "./shared";

export default function Security() {
  const [pwOpen, setPwOpen] = useState(false);

  return (
    <div className="space-y-6">
      <SectionCard title="Authentication" description="Manage your password and authentication methods.">
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl border border-border">
            <div className="flex items-center gap-3">
              <KeyRound className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">Password</div>
                <div className="text-xs text-muted-foreground">Used to sign in to your account</div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setPwOpen(true)}>Change password</Button>
          </div>

          <TwoFactorRow />
        </div>
      </SectionCard>

      <ConnectedAccounts />

      <SignOutOtherDevices />

      <ChangePasswordDialog open={pwOpen} onClose={() => setPwOpen(false)} />
    </div>
  );
}

/* ───── Two-factor authentication ───── */

function TwoFactorRow() {
  const { listMfaFactors } = useAuth();
  const [factors, setFactors] = useState<MfaFactor[] | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [disableTarget, setDisableTarget] = useState<MfaFactor | null>(null);

  const reload = () => listMfaFactors().then(setFactors).catch(() => setFactors([]));
  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // Unverified factors are abandoned setup attempts — they protect nothing, so
  // showing them as "on" would be the exact misreport we're removing.
  const active = factors?.find((f) => f.status === "verified") ?? null;

  return (
    <>
      <div className="flex items-center justify-between p-4 rounded-xl border border-border">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-muted-foreground" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Two-factor authentication</span>
              {active && (
                <Badge variant="secondary" className="bg-[hsl(var(--status-active))]/10 text-[hsl(var(--status-active))] text-xs">
                  On
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {active
                ? "You'll be asked for a code from your authenticator app when you sign in."
                : "Add an extra layer of security with an authenticator app"}
            </div>
          </div>
        </div>
        {factors === null ? (
          <Skeleton className="h-8 w-20" />
        ) : active ? (
          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDisableTarget(active)}>
            Turn off
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setSetupOpen(true)}>Set up</Button>
        )}
      </div>

      <TwoFactorSetupDialog
        open={setupOpen}
        onClose={() => setSetupOpen(false)}
        onDone={() => { setSetupOpen(false); reload(); }}
      />

      <DisableTwoFactorDialog
        factor={disableTarget}
        onClose={() => setDisableTarget(null)}
        onDone={() => { setDisableTarget(null); reload(); }}
      />
    </>
  );
}

function TwoFactorSetupDialog({
  open, onClose, onDone,
}: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { startMfaEnrolment, confirmMfaEnrolment } = useAuth();
  const [enrolment, setEnrolment] = useState<MfaEnrolment | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) { setEnrolment(null); setCode(""); setError(null); return; }
    startMfaEnrolment()
      .then(setEnrolment)
      .catch((e) => setError((e as Error).message));
  }, [open, startMfaEnrolment]);

  const verify = async () => {
    if (!enrolment) return;
    setBusy(true);
    setError(null);
    try {
      await confirmMfaEnrolment(enrolment.factorId, code);
      toast.success("Two-factor authentication is on");
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle>Set up two-factor authentication</DialogTitle>
          <DialogDescription>
            Scan this code with an authenticator app, then enter the 6-digit code it shows.
          </DialogDescription>
        </DialogHeader>

        {!enrolment ? (
          <div className="flex justify-center py-8">
            {error ? (
              <p className="text-sm text-destructive text-center">{error}</p>
            ) : (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
            )}
          </div>
        ) : (
          <div className="space-y-4 py-1">
            <div className="flex justify-center">
              {/* Supabase returns the QR as an SVG data URI — no QR library. */}
              <img
                src={enrolment.qrCode}
                alt="Two-factor setup QR code"
                className="h-44 w-44 rounded-lg border border-border bg-white p-2"
              />
            </div>

            <div className="rounded-lg bg-secondary/50 p-3">
              <p className="text-xs text-muted-foreground">Can't scan it? Enter this key instead:</p>
              <code className="mt-1 block break-all font-mono text-xs">{enrolment.secret}</code>
            </div>

            <Field label="Code from your app">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(e) => { if (e.key === "Enter" && code.length === 6 && !busy) verify(); }}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                className="text-center text-lg tracking-[0.4em]"
              />
            </Field>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={verify} disabled={!enrolment || code.length !== 6 || busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Turn on
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DisableTwoFactorDialog({
  factor, onClose, onDone,
}: { factor: MfaFactor | null; onClose: () => void; onDone: () => void }) {
  const { disableMfa } = useAuth();
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (!factor) return;
    setBusy(true);
    try {
      await disableMfa(factor.id);
      toast.success("Two-factor authentication is off");
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={!!factor} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Turn off two-factor authentication?</AlertDialogTitle>
          <AlertDialogDescription>
            Your account will be protected by your password alone. Anyone who learns it will be able
            to read candidate applications, CVs and interview recordings, and post jobs as your
            company.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Keep it on</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); confirm(); }}
            disabled={busy}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Turn off
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ───── Connected accounts ───── */

const PROVIDER_LABELS: Record<string, string> = { google: "Google", apple: "Apple" };

function ConnectedAccounts() {
  const { getLinkedProviders, linkProvider, unlinkProvider } = useAuth();
  const [linked, setLinked] = useState<{ provider: string; email: string | null }[] | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const reload = () => getLinkedProviders().then(setLinked).catch(() => setLinked([]));
  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const toggle = async (provider: "google" | "apple", isLinked: boolean) => {
    setPending(provider);
    try {
      if (isLinked) {
        await unlinkProvider(provider);
        toast.success(`${PROVIDER_LABELS[provider]} disconnected`);
        setLinked(await getLinkedProviders());
      } else {
        // Redirects to the provider and back, so nothing after this runs.
        await linkProvider(provider);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPending(null);
    }
  };

  return (
    <SectionCard
      title="Connected accounts"
      description="Sign-in methods linked to this account."
    >
      {linked === null ? (
        <Skeleton className="h-24 w-full rounded-xl" />
      ) : (
        <div className="space-y-3">
          {(["google", "apple"] as const).map((provider) => {
            const match = linked.find((l) => l.provider === provider);
            // Email/password is an identity too; unlinking the last one would
            // lock the account, and Supabase refuses it — so do we, clearly.
            const isLast = linked.length <= 1 && !!match;
            return (
              <div key={provider} className="flex items-center justify-between p-4 rounded-xl border border-border">
                <div className="flex items-center gap-3">
                  <Link2 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">{PROVIDER_LABELS[provider]}</div>
                    <div className="text-xs text-muted-foreground">
                      {match ? (match.email ?? "Connected") : "Not connected"}
                    </div>
                  </div>
                </div>
                {match ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    disabled={pending === provider || isLast}
                    title={isLast ? "This is your only way to sign in." : undefined}
                    onClick={() => toggle(provider, true)}
                  >
                    {pending === provider && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending === provider}
                    onClick={() => toggle(provider, false)}
                  >
                    {pending === provider && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                    Connect
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

/* ───── Sign out other devices ───── */

function SignOutOtherDevices() {
  const { signOutOtherDevices } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      await signOutOtherDevices();
      setDone(true);
      setConfirming(false);
      toast.success("Signed out everywhere else");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SectionCard
        title="Other devices"
        description="If you think someone else has access to your account, sign out everywhere and change your password."
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {done
              ? "Every other browser and device is being signed out — within about 30 seconds."
              : "This device stays signed in. Everything else is signed out within about 30 seconds."}
          </p>
          <Button variant="outline" size="sm" onClick={() => setConfirming(true)} disabled={busy}>
            <LogOut className="h-3.5 w-3.5" />
            Sign out other devices
          </Button>
        </div>
        {done && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-[hsl(var(--status-active))]">
            <Check className="h-3.5 w-3.5" aria-hidden="true" /> Done
          </p>
        )}
      </SectionCard>

      <AlertDialog open={confirming} onOpenChange={(o) => !o && setConfirming(false)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out other devices?</AlertDialogTitle>
            <AlertDialogDescription>
              Anyone signed in as you on another browser or device will be signed out within about 30 seconds.
              You'll stay signed in here.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); run(); }} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Sign out other devices
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ───── Change Password dialog ───── */
function ChangePasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  // The same call the job-seeker settings page uses: re-authenticates with the
  // current password, then sets the new one.
  const { changePassword } = useAuth();
  const [current, setCurrent]       = useState("");
  const [next, setNext]             = useState("");
  const [confirm, setConfirm]       = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext]     = useState(false);
  const [loading, setLoading]       = useState(false);

  const reset = () => {
    setCurrent(""); setNext(""); setConfirm("");
    setShowCurrent(false); setShowNext(false);
  };
  const handleClose = () => { reset(); onClose(); };

  const tooShort = next.length > 0 && next.length < 8;
  const mismatch = confirm.length > 0 && next !== confirm;
  const valid    = current.length > 0 && next.length >= 8 && next === confirm;

  const handleSave = async () => {
    setLoading(true);
    try {
      await changePassword(current, next);
      handleClose();
      toast.success("Password updated");
    } catch (e) {
      // Stay open on failure — a wrong current password is worth another try,
      // and the dialog closing would read as success.
      toast.error((e as Error).message || "Couldn't update your password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>Choose a strong password with at least 8 characters.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <Field label="Current password">
            <div className="relative">
              <Input
                type={showCurrent ? "text" : "password"}
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                placeholder="Enter current password"
                className="pr-9"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>
          <Field label="New password">
            <div className="relative">
              <Input
                type={showNext ? "text" : "password"}
                value={next}
                onChange={(e) => setNext(e.target.value)}
                placeholder="At least 8 characters"
                className={cn("pr-9", tooShort && "border-destructive")}
              />
              <button
                type="button"
                onClick={() => setShowNext(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNext ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {tooShort && <p className="text-xs text-destructive mt-1">Must be at least 8 characters.</p>}
          </Field>
          <Field label="Confirm new password">
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat new password"
              className={cn(mismatch && "border-destructive")}
            />
            {mismatch && <p className="text-xs text-destructive mt-1">Passwords do not match.</p>}
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>Cancel</Button>
          <Button disabled={!valid || loading} onClick={handleSave}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Update password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
