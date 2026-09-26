import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Blocks the app while a session is signed in but hasn't cleared its second
 * factor.
 *
 * Not dismissible: the API rejects these sessions, so letting someone past this
 * point only produces a screen of failed requests. The way out is a valid code
 * or signing out.
 */
export function MfaChallengeDialog() {
  const { mfaRequired, verifyMfaChallenge, logout } = useAuth();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!mfaRequired) return null;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await verifyMfaChallenge(code);
      setCode("");
    } catch (e) {
      setError((e as Error).message);
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open>
      <DialogContent
        className="max-w-sm rounded-2xl [&>button]:hidden"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-primary-soft">
            <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <DialogTitle className="text-center">Enter your verification code</DialogTitle>
          <DialogDescription className="text-center">
            Open your authenticator app and enter the 6-digit code for this account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && code.length === 6 && !busy) submit();
            }}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            placeholder="000000"
            aria-label="Verification code"
            className="text-center text-lg tracking-[0.4em]"
          />
          {error && <p className="text-center text-xs text-destructive">{error}</p>}

          <Button className="w-full" onClick={submit} disabled={code.length !== 6 || busy}>
            {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />}
            Verify
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => logout()} disabled={busy}>
            Sign out instead
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default MfaChallengeDialog;
