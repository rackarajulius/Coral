import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Building2, CheckCircle2, Clock, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import AuthModal from "@/components/AuthModal";
import { useAuth } from "@/contexts/AuthContext";
import { accountSide } from "@/lib/accountSide";
import { ROLE_LABELS } from "@/lib/api/companyTeam";
import {
  acceptInvitation, acceptJoinLink, previewInvitation, previewJoinLink,
  type InvitationPreview, type JoinOutcome, type JoinPreview,
} from "@/lib/api/companyJoin";

/**
 * Landing page for both ways into a company: a shared join link, and an
 * invitation addressed to one person (?invite=1).
 *
 * Shows what the link is for *before* asking anyone to sign in — a bare link
 * with no context is indistinguishable from a phishing attempt, and someone
 * should be able to see whose team they are joining before handing over
 * anything.
 */
export default function JoinCompany() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") ?? "";
  // Two different objects arrive on this page: a shared join link, and an
  // invitation addressed to one person. They have different rules, so the link
  // says which it is rather than the page guessing from the token.
  const isInvitation = params.get("invite") === "1";
  const { user, isAuthenticated, isLoading, refreshUser } = useAuth();
  const [outcome, setOutcome] = useState<JoinOutcome | null>(null);
  const [showAuth, setShowAuth] = useState(false);

  const preview = useQuery<JoinPreview | InvitationPreview>({
    queryKey: ["join-preview", token, isInvitation],
    queryFn: () => (isInvitation ? previewInvitation(token) : previewJoinLink(token)),
    enabled: !!token,
    retry: false,
  });

  const accept = useMutation({
    mutationFn: () => (isInvitation ? acceptInvitation(token) : acceptJoinLink(token)),
    onSuccess: async (result) => {
      // Joining flips the account to an active employer, so the session has to
      // be refetched or the dashboard bounces them into company setup.
      await refreshUser?.().catch(() => undefined);
      setOutcome(result);
    },
  });

  // Close the modal once they're signed in; they still press Join themselves.
  useEffect(() => {
    if (isAuthenticated) setShowAuth(false);
  }, [isAuthenticated]);

  if (!token) return <Shell><Message title="Nothing to join" body="This link is missing its code. Ask for a fresh one." /></Shell>;
  if (isLoading || preview.isLoading) {
    return <Shell><Skeleton className="h-40 w-full rounded-xl" /></Shell>;
  }
  if (preview.isError || !preview.data) {
    return (
      <Shell>
        <Message
          title="This link doesn't work"
          body={(preview.error as Error)?.message || "It may have expired or been replaced. Ask whoever sent it for a new one."}
        />
      </Shell>
    );
  }

  const { companyName, role } = preview.data;
  // Only a shared link carries a domain lock; only an invitation carries the
  // address it was sent to.
  const domainLocked = "domainLocked" in preview.data ? preview.data.domainLocked : false;
  const domain = "domain" in preview.data ? preview.data.domain : null;
  const invitedEmail = "email" in preview.data ? preview.data.email : null;
  const signedInAs = user?.email?.trim().toLowerCase() ?? null;
  const wrongAccount =
    !!invitedEmail && !!signedInAs && signedInAs !== invitedEmail.trim().toLowerCase();
  // Joining makes an employer account. A job seeker account can't (the server
  // refuses), so say so before they press the button, not after.
  const side = accountSide(user);
  const cantJoin = isAuthenticated && (side === "seeker" || side === "other");

  if (outcome) {
    const queued = outcome.status === "PENDING";
    return (
      <Shell>
        <div className="text-center">
          <div className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full ${queued ? "bg-amber-500/10" : "bg-emerald-500/10"}`}>
            {queued
              ? <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              : <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />}
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            {queued ? "Request sent" : `You're in`}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {queued
              ? outcome.pendingReason ??
                `Someone at ${outcome.companyName} needs to approve you. Nothing is shared before then.`
              : `You've joined ${outcome.companyName} as a ${ROLE_LABELS[outcome.role].toLowerCase()}.`}
          </p>
          {!queued && (
            <Button className="mt-5" onClick={() => navigate("/employers/dashboard", { replace: true })}>
              Go to the dashboard
            </Button>
          )}
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft">
          <Building2 className="h-5 w-5 text-primary" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">Join {companyName}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You'll join as a <strong className="text-foreground">{ROLE_LABELS[role].toLowerCase()}</strong> and
          be able to see this company's jobs, candidates and messages.
        </p>
      </div>

      {/* Said up front, not after they commit: someone on a personal address
          should know they're requesting rather than joining. */}
      {domainLocked && domain && (
        <p className="mt-5 flex items-start gap-2 rounded-lg bg-secondary/50 p-3 text-xs text-muted-foreground">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            {isAuthenticated && user?.email && !user.email.toLowerCase().endsWith(`@${domain}`)
              ? `You're signed in as ${user.email}, which isn't on @${domain} — your request will wait for approval.`
              : `Sign in with your @${domain} address to join straight away. Other addresses are approved by an owner first.`}
          </span>
        </p>
      )}

      {/* An addressed invitation only works for its recipient. Saying so before
          they press the button beats a 403 afterwards, and it's the commonest
          way this goes wrong — being signed in as the wrong account. */}
      {invitedEmail && (
        <p
          className={`mt-5 flex items-start gap-2 rounded-lg p-3 text-xs ${
            wrongAccount
              ? "border border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-400"
              : "bg-secondary/50 text-muted-foreground"
          }`}
        >
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            {wrongAccount
              ? `This invitation was sent to ${invitedEmail}, but you're signed in as ${user?.email}. Sign out and sign back in with ${invitedEmail} to accept it.`
              : `Sent to ${invitedEmail}. Only that address can accept it.`}
          </span>
        </p>
      )}

      {cantJoin && (
        <p className="mt-5 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            {side === "seeker"
              ? `You're signed in as ${user?.email}, a job seeker account — it can't join a company. Sign out and sign in with an employer account, or create one with a different email.`
              : `You're signed in as ${user?.email}, which can't join a company. Sign in with an employer account to join.`}
          </span>
        </p>
      )}

      <div className="mt-6">
        {isAuthenticated ? (
          <>
            <Button
              className="w-full"
              onClick={() => accept.mutate()}
              disabled={accept.isPending || wrongAccount || cantJoin}
            >
              {accept.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Join {companyName}
            </Button>
            {accept.isError && (
              <p className="mt-2 text-center text-xs text-destructive">
                {(accept.error as Error).message}
              </p>
            )}
            <p className="mt-2 text-center text-xs text-muted-foreground">Signed in as {user?.email}</p>
          </>
        ) : (
          <Button className="w-full" onClick={() => setShowAuth(true)}>
            Sign in to continue
          </Button>
        )}
      </div>

      {showAuth && (
        <AuthModal open initialView="signup" onClose={() => setShowAuth(false)} onAuthenticated={() => setShowAuth(false)} />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-7">{children}</div>
    </div>
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div className="text-center">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
