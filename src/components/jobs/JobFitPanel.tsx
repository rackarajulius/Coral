import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Check, Loader2, Sparkles, Target, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  getJobFit,
  tailorResumeForJob,
  type ResumeTailoring,
} from "@/lib/api/jobs";

/**
 * "Where do I stand, and how do I win this?" for one job.
 *
 * Matched/missing skills come from an exact comparison server-side — never the
 * LLM — so the ✓/✗ lists can't claim a skill the candidate never listed. The AI
 * only writes the verdict and the tailored resume, both grounded in real data.
 *
 * Kept per job in the query cache: the verdict costs an AI call, and this used
 * to refetch on every click, so browsing ten listings and returning to the
 * first meant eleven of them — each with a "Checking your fit…" flash.
 */
export default function JobFitPanel({ jobId }: { jobId: string }) {
  const { user, isAuthenticated } = useAuth();
  const [tailoring, setTailoring] = useState(false);
  const [result, setResult] = useState<ResumeTailoring | null>(null);

  const { data: fit, isLoading } = useQuery({
    // Per account as well as per job, so one person's fit is never shown to
    // the next on a shared browser.
    queryKey: ["job-fit", jobId, user?.id],
    queryFn: () => getJobFit(jobId),
    enabled: isAuthenticated,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    // Coming back to the tab is not a reason to spend another AI call.
    refetchOnWindowFocus: false,
    retry: false,
  });

  // A tailored resume belongs to the job it was written for.
  useEffect(() => setResult(null), [jobId]);

  const tailor = async () => {
    setTailoring(true);
    try {
      setResult(await tailorResumeForJob(jobId));
    } catch (e) {
      toast.error((e as Error).message || "Couldn't tailor your resume");
    } finally {
      setTailoring(false);
    }
  };

  // Signed out, or nothing useful to say — stay out of the way entirely.
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Checking your fit…
      </div>
    );
  }
  if (!fit) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-foreground">
        <Target className="h-4 w-4 text-coral" /> Your fit
      </h2>

      {fit.noProfileSignal ? (
        <p className="text-sm text-muted-foreground">
          Add your skills or a resume to your{" "}
          <Link to="/jobseeker/profile" className="text-coral hover:underline">
            profile
          </Link>{" "}
          to see how you match this role.
        </p>
      ) : fit.jobListsNoSkills ? (
        <p className="text-sm text-muted-foreground">
          This posting doesn't list required skills, so there's nothing to compare against.
          {fit.verdict && <span className="mt-2 block text-foreground/80">{fit.verdict}</span>}
        </p>
      ) : (
        <>
          {fit.verdict && <p className="mb-3 text-sm text-foreground/80">{fit.verdict}</p>}

          <div className="space-y-2">
            {fit.matchedSkills.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {fit.matchedSkills.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400"
                  >
                    <Check className="h-3 w-3" /> {s}
                  </span>
                ))}
              </div>
            )}

            {fit.missingSkills.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {fit.missingSkills.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
                  >
                    <X className="h-3 w-3" /> {s}
                  </span>
                ))}
              </div>
            )}
          </div>

          {fit.missingSkills.length > 0 && (
            <p className="mt-2.5 text-xs text-muted-foreground">
              {fit.missingSkills.length} of {fit.matchedSkills.length + fit.missingSkills.length}{" "}
              listed skills aren't on your profile — that doesn't rule you out, but it's what an
              employer will look for.
            </p>
          )}

          {fit.gaps.length > 0 && (
            <ul className="mt-3 space-y-1">
              {fit.gaps.slice(0, 3).map((g) => (
                <li key={g} className="flex gap-2 text-xs text-muted-foreground">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" />
                  {g}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {/* Tailoring — turns the analysis into something actionable. */}
      {!fit.noProfileSignal && (
        <div className="mt-4 border-t border-border pt-4">
          {!result ? (
            <Button variant="outline" size="sm" onClick={tailor} disabled={tailoring} className="gap-1.5">
              {tailoring ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {tailoring ? "Tailoring…" : "Tailor my resume for this job"}
            </Button>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Suggested summary
                </p>
                <p className="rounded-xl bg-muted/50 p-3 text-sm text-foreground/90">
                  {result.tailoredSummary}
                </p>
              </div>

              {result.emphasizedSkills.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Lead with these
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.emphasizedSkills.map((s) => (
                      <span key={s} className="rounded-full bg-coral/10 px-2.5 py-1 text-xs text-coral">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {result.suggestions.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Edits to make
                  </p>
                  <ul className="space-y-1">
                    {result.suggestions.map((s) => (
                      <li key={s} className="flex gap-2 text-sm text-muted-foreground">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-coral" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    void navigator.clipboard.writeText(result.tailoredSummary);
                    toast.success("Summary copied");
                  }}
                >
                  Copy summary
                </Button>
                <button
                  type="button"
                  onClick={() => setResult(null)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Redo
                </button>
              </div>

              <p className="text-xs text-muted-foreground">
                Suggestions only — built from your real resume. Apply them in your{" "}
                <Link to="/jobseeker/profile" className="text-coral hover:underline">
                  profile
                </Link>
                , then attach the updated file when you apply.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
