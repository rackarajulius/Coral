import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { getMyAppliedJobs, type MyJobApplication } from "@/lib/api/applications";
import { trackEvent } from "@/lib/api/analyticsEvents";
import { createExternalApplication } from "@/lib/api/externalApplications";
import { toast } from "sonner";

const EMPTY: Map<string, MyJobApplication> = new Map();

/**
 * Shared apply state for the job pages: which jobs the user has already applied
 * to, and the auth-gated handler that opens the apply dialog.
 *
 * Held in the query cache, not in this hook's own state, because the job
 * details panel is remounted on every click (`key={job.id}` in JobListings).
 * With per-mount state, clicking away from an applied job and back threw the
 * list away and refetched it, so the button read "Apply with Coral" for a
 * second or two before turning back into "Applied".
 */
export function useApply() {
  const { user, isAuthenticated } = useAuth();
  const { requireAuth } = useAuthModal();
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<{ id: string; title: string; company: string; location?: string; description?: string } | null>(null);

  // Per account: a shared browser must never show one person's applications to
  // the next. Signing out clears the cache (see signOutHooks), and the query is
  // disabled anyway.
  const key = ["my-applied-jobs", user?.id] as const;
  const { data, isPending } = useQuery({
    queryKey: key,
    queryFn: getMyAppliedJobs,
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const applied = data ?? EMPTY;

  /**
   * Routes the apply action the way the employer configured the job:
   * external → their website, email → a prefilled mail draft, otherwise the
   * in-platform Quick Apply dialog (which is the only one needing sign-in).
   */
  const startApply = useCallback(
    (job: {
      id: string;
      title: string;
      company: string;
      applicationMethod?: "internal" | "external" | "email" | null;
      applicationUrl?: string | null;
      applicationEmail?: string | null;
      location?: string;
      description?: string;
    }) => {
      // Recorded before branching so every route counts equally. For external
      // and email applications this is the LAST thing measurable — the rest of
      // that funnel happens on someone else's site.
      trackEvent("apply_click", { jobId: job.id });

      if (job.applicationMethod === "external" && job.applicationUrl) {
        window.open(job.applicationUrl, "_blank", "noopener,noreferrer");
        if (isAuthenticated && user?.role === "JOB_SEEKER") {
          void createExternalApplication({
            sourceKey: `coral:${job.id}`,
            title: job.title,
            company: job.company,
            url: job.applicationUrl,
          }).then(() => {
            void queryClient.invalidateQueries({ queryKey: ["external-applications"] });
            toast.success("Saved to External tracker. Mark applied after you submit.");
          }).catch(() => toast.error("Couldn't save this job to External tracker"));
        }
        return;
      }
      if (job.applicationMethod === "email" && job.applicationEmail) {
        const subject = encodeURIComponent(`Application: ${job.title}`);
        window.location.href = `mailto:${job.applicationEmail}?subject=${subject}`;
        if (isAuthenticated && user?.role === "JOB_SEEKER") {
          void createExternalApplication({
            sourceKey: `coral:${job.id}`,
            title: job.title,
            company: job.company,
          }).then(() => void queryClient.invalidateQueries({ queryKey: ["external-applications"] }))
            .catch(() => toast.error("Couldn't save this job to External tracker"));
        }
        return;
      }
      requireAuth(() => {
        // After the auth gate: the dialog is genuinely open and being filled in.
        trackEvent("apply_started", { jobId: job.id });
        setTarget({ id: job.id, title: job.title, company: job.company, location: job.location, description: job.description });
      });
    },
    [requireAuth, isAuthenticated, user?.role, queryClient],
  );

  /** Written straight into the cache, so every job card sees it at once. */
  const markApplied = useCallback(
    (jobId: string) => {
      queryClient.setQueryData<Map<string, MyJobApplication>>(key, (prev) => {
        const next = new Map(prev ?? EMPTY);
        if (!next.has(jobId)) next.set(jobId, { appliedAt: new Date().toISOString(), status: "pending" });
        return next;
      });
    },
    // `key` is derived from the account id and is stable between renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, user?.id],
  );

  return {
    appliedIds: new Set(applied.keys()),
    hasApplied: (jobId: string) => applied.has(jobId),
    /** When the user applied to this job (ISO), if they did. */
    appliedAt: (jobId: string) => applied.get(jobId)?.appliedAt ?? null,
    /** The user's application to this job, if any. */
    applicationFor: (jobId: string) => applied.get(jobId) ?? null,
    /**
     * False only while the list is still on its way for a signed-in user.
     * Callers use it to avoid offering "Apply" for a job already applied to.
     */
    appliedKnown: !isAuthenticated || !isPending,
    target,
    setTarget,
    startApply,
    markApplied,
  };
}
