import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  getVerification,
  requestCompanyVerification,
  uploadVerificationDocument,
  verifyByDomain,
} from "@/lib/api/employerOnboarding";

const ACCEPT = "image/png,image/jpeg,image/webp,application/pdf";
const MAX_MB = 10;

/**
 * Document submission for employers who can't verify by domain.
 *
 * Uploads first, then submits the request referencing the stored path — two
 * endpoints, so a failed upload never creates a request pointing at nothing.
 */
function DocumentReview() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submit = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Choose a document first");
      const documentUrl = await uploadVerificationDocument(file);
      return requestCompanyVerification({ documentUrl, note: note.trim() || undefined });
    },
    onSuccess: () => {
      setSubmitted(true);
      toast.success("Sent for review", {
        description: "We'll let you know once someone has looked at it.",
      });
      queryClient.invalidateQueries({ queryKey: ["employer-verification"] });
    },
    onError: (e) => toast.error((e as Error).message || "Couldn't submit for review"),
  });

  if (submitted) {
    return (
      <p className="mt-3 rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
        Your document is with our team. You'll get a notification when it's reviewed — usually
        within a couple of working days.
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-border bg-card p-3">
      <p className="text-xs font-medium text-foreground">Send a document instead</p>
      <p className="text-[11px] text-muted-foreground">
        Anything that shows the company is real and that you work there — a business registration,
        a utility bill in the company's name, or a letter on company letterhead.
      </p>

      <input
        type="file"
        accept={ACCEPT}
        aria-label="Company document"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          // Checked here as well as server-side so the person isn't left
          // waiting on an upload that was always going to be rejected.
          if (f && f.size > MAX_MB * 1024 * 1024) {
            toast.error(`That file is over ${MAX_MB}MB`);
            return;
          }
          setFile(f);
        }}
        className="block w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-muted/70"
      />

      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Anything that helps us check (optional)"
        className="min-h-[60px] resize-y text-xs"
        maxLength={1000}
      />

      <Button size="sm" onClick={() => submit.mutate()} disabled={!file || submit.isPending}>
        {submit.isPending && (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        )}
        Send for review
      </Button>

      <p className="text-[11px] text-muted-foreground">
        Only our review team sees this. It is never shown on your company profile.
      </p>
    </div>
  );
}

/**
 * Company verification status and the route out of it.
 *
 * Exists because the gates on posting and inviting return a 403 with a message
 * and nothing else — without somewhere to actually verify, an employer hits
 * that wall with no way through.
 */
export function VerificationCard({ compact = false }: { compact?: boolean }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["employer-verification"],
    queryFn: getVerification,
    retry: false,
  });

  const verify = useMutation({
    mutationFn: verifyByDomain,
    onSuccess: () => {
      toast.success("Company verified", {
        description: "You can now post jobs and contact candidates.",
      });
      queryClient.invalidateQueries({ queryKey: ["employer-verification"] });
      queryClient.invalidateQueries({ queryKey: ["employer-brand-score"] });
    },
    onError: (e) => toast.error((e as Error).message || "Couldn't verify"),
  });

  if (isLoading) return <Skeleton className="h-28 w-full rounded-xl" />;
  if (!data) return null;

  // Fully verified — nothing to prompt, so stay out of the way.
  if (data.level === "verified" && compact) return null;

  const verified = data.canReachCandidates;

  return (
    <div
      className={
        verified
          ? "rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4"
          : "rounded-xl border border-amber-500/40 bg-amber-500/5 p-4"
      }
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
        {data.level === "verified" ? (
          <BadgeCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        ) : verified ? (
          <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        ) : (
          <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        )}
        {data.level === "verified"
          ? "Verified company"
          : verified
            ? "Email domain confirmed"
            : "Verify your company"}
      </p>

      {!verified && (
        <p className="mt-1 text-xs text-muted-foreground">
          You can't post jobs or contact candidates until your company is confirmed. This protects
          candidates from fake listings.
        </p>
      )}

      {data.reason && (
        <p className="mt-2 text-xs text-foreground/80">{data.reason}</p>
      )}

      {data.canAutoVerify && (
        <Button
          size="sm"
          className="mt-3"
          onClick={() => verify.mutate()}
          disabled={verify.isPending}
        >
          {verify.isPending && (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          )}
          Verify instantly with {data.workDomain}
        </Button>
      )}

      {/* Free-mail employers can't domain-verify, so this is their only route
          through. Without it they can complete setup and never post a job. */}
      {data.needsDocuments && <DocumentReview />}

      {verified && data.level === "domain_verified" && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          A matching email domain lets you start hiring. The full verified badge shown to candidates
          needs a document reviewed by a person.
        </p>
      )}
    </div>
  );
}

export default VerificationCard;
