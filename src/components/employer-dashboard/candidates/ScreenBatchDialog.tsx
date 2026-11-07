import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Languages, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SCREENING_LANGUAGES,
  generateJobScreeningQuestions,
  getJobScreeningQuestions,
  inviteScreenBatch,
  type JobScreeningQuestions,
  type ScreenMode,
  type ScreenSkipReason,
} from "@/lib/api/aiScreen";
import type { Candidate } from "@/data/employer/Candidates/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The currently selected candidates. */
  candidates: Candidate[];
  onSent?: () => void;
}

const SKIP_LABEL: Record<ScreenSkipReason, string> = {
  not_an_applicant: "no longer an applicant for this job",
  already_invited: "already invited",
  cap_reached: "over this job's screening limit",
};

/**
 * Invites a job's applicants to one screening round.
 *
 * Every candidate is asked the SAME questions — that's what makes their scores
 * comparable — so a round is scoped to a single job and the questions are shown
 * for review before anything is sent.
 */
export function ScreenBatchDialog({ open, onOpenChange, candidates, onSent }: Props) {
  const navigate = useNavigate();
  const [set, setSet] = useState<JobScreeningQuestions | null>(null);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [mode, setMode] = useState<ScreenMode>("text");
  const [error, setError] = useState<string | null>(null);

  // A round belongs to one job. Sourced candidates never applied, so they have
  // no job to be screened against.
  const { jobIds, eligible, withoutJob } = useMemo(() => {
    const withJob = candidates.filter((c) => c.jobId && c.applicantId);
    return {
      jobIds: [...new Set(withJob.map((c) => c.jobId as string))],
      eligible: withJob,
      withoutJob: candidates.length - withJob.length,
    };
  }, [candidates]);

  const jobId = jobIds.length === 1 ? jobIds[0] : null;

  const load = useCallback(async () => {
    if (!jobId) return;
    setLoading(true);
    setError(null);
    try {
      setSet(await getJobScreeningQuestions(jobId));
    } catch {
      setError("Couldn't load this job's screening questions.");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    if (!open) return;
    setSet(null);
    void load();
  }, [open, load]);

  const generate = async (regenerate: boolean, language?: string) => {
    if (!jobId) return;
    setWorking(true);
    setError(null);
    try {
      setSet(await generateJobScreeningQuestions(jobId, { regenerate, language }));
    } catch (e) {
      setError((e as Error).message || "Couldn't generate questions.");
    } finally {
      setWorking(false);
    }
  };

  const send = async () => {
    if (!jobId) return;
    setWorking(true);
    try {
      const result = await inviteScreenBatch(jobId, {
        candidateIds: eligible.map((c) => c.applicantId as string),
        mode,
      });

      const sent = result.invited.length;
      if (sent === 0) {
        // Never report success for an empty batch.
        toast.error("No invitations were sent", {
          description: summarizeSkips(result.skipped),
        });
      } else {
        toast.success(`Invited ${sent} candidate${sent === 1 ? "" : "s"}`, {
          description: result.skipped.length
            ? `${result.questionCount} questions each. Skipped ${result.skipped.length}: ${summarizeSkips(result.skipped)}`
            : `${result.questionCount} questions each. They'll be notified now.`,
          action: {
            label: "View results",
            onClick: () => navigate(`/employers/jobs/${jobId}/screening`),
          },
        });
        if (result.postingNowSaysAi) {
          toast("The posting now says AI helps screen applicants", {
            description: "Candidates see it on the job, and it stays on for this job.",
          });
        }
      }
      onSent?.();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message || "Couldn't send the invitations");
    } finally {
      setWorking(false);
    }
  };

  const questions = set?.questions ?? [];
  const canSend = !!jobId && questions.length > 0 && eligible.length > 0 && !working && !loading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
            AI screening round
          </DialogTitle>
          <DialogDescription>
            {set?.jobTitle
              ? `Every candidate for ${set.jobTitle} is asked the same questions, so their scores can be compared.`
              : "Every candidate in a round is asked the same questions, so their scores can be compared."}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[52vh] space-y-4 overflow-y-auto px-6 py-4">
          {jobIds.length > 1 ? (
            <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              Your selection spans {jobIds.length} jobs. Each job has its own question set — select
              candidates from one job to start a round.
            </p>
          ) : !jobId ? (
            <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              None of the selected candidates applied to a job on the platform, so there's no role to
              screen them against.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="secondary" className="border-0">
                  {eligible.length} candidate{eligible.length === 1 ? "" : "s"}
                </Badge>
                {withoutJob > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {withoutJob} skipped — sourced, not applicants
                  </span>
                )}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Questions
                  </p>
                  <div className="flex items-center gap-1">
                    {/* Changing language regenerates: the existing set is in
                        the wrong one, so the two decisions are really one. */}
                    <Select
                      value={set?.language ?? "en-US"}
                      onValueChange={(v) => void generate(true, v)}
                      disabled={working}
                    >
                      <SelectTrigger className="h-7 w-auto gap-1 border-0 px-2 text-xs" aria-label="Interview language">
                        <Languages className="h-3 w-3" aria-hidden="true" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SCREENING_LANGUAGES.map((l) => (
                          <SelectItem key={l.tag} value={l.tag}>
                            {l.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {questions.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={working}
                        onClick={() => void generate(true)}
                      >
                        <RefreshCw className="mr-1 h-3 w-3" aria-hidden="true" />
                        Regenerate
                      </Button>
                    )}
                  </div>
                </div>

                {loading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-4 w-4/6" />
                  </div>
                ) : questions.length > 0 ? (
                  <ol className="space-y-2 text-sm">
                    {questions.map((q, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="shrink-0 tabular-nums text-muted-foreground">{i + 1}.</span>
                        <span>{q}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="rounded-lg border border-dashed border-border p-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      No questions for this job yet.
                    </p>
                    <Button
                      size="sm"
                      className="mt-3"
                      disabled={working}
                      onClick={() => void generate(false)}
                    >
                      {working && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                      Generate questions
                    </Button>
                  </div>
                )}

                {set && set.screenCount > 0 && questions.length > 0 && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    {set.screenCount} candidate{set.screenCount === 1 ? " has" : "s have"} already been
                    screened for this job. Regenerating means new candidates answer different
                    questions, and their scores stop being comparable with earlier ones.
                  </p>
                )}
              </div>

              {questions.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Answer format
                  </p>
                  <RadioGroup
                    value={mode}
                    onValueChange={(v) => setMode(v as ScreenMode)}
                    className="gap-2"
                  >
                    <div className="flex items-start gap-2">
                      <RadioGroupItem value="text" id="screen-mode-text" className="mt-0.5" />
                      <Label htmlFor="screen-mode-text" className="cursor-pointer font-normal">
                        Written answers
                        <span className="block text-xs text-muted-foreground">
                          Scored by AI — you get a scorecard per candidate.
                        </span>
                      </Label>
                    </div>
                    <div className="flex items-start gap-2">
                      <RadioGroupItem value="live" id="screen-mode-live" className="mt-0.5" />
                      <Label htmlFor="screen-mode-live" className="cursor-pointer font-normal">
                        Live AI interview
                        <span className="block text-xs text-muted-foreground">
                          A spoken conversation with follow-up questions, then a scorecard.
                          Candidates consent before starting and get one attempt.
                        </span>
                      </Label>
                    </div>
                    <div className="flex items-start gap-2">
                      <RadioGroupItem value="video" id="screen-mode-video" className="mt-0.5" />
                      <Label htmlFor="screen-mode-video" className="cursor-pointer font-normal">
                        Recorded video
                        <span className="block text-xs text-muted-foreground">
                          Not scored — you watch and judge the answers yourself.
                        </span>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              )}

              {questions.length > 0 && mode !== "video" && (
                // Said before sending: the AI scores these answers, so the
                // posting has to say AI helps screen (Ontario requires it).
                <p className="text-xs text-muted-foreground">
                  The AI scores these answers, so sending adds "AI is used to screen, assess or select
                  applicants" to the posting, if it doesn't say so already. It stays on for this job.
                </p>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}
            </>
          )}
        </div>

        <DialogFooter className="border-t border-border px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={working}>
            Cancel
          </Button>
          <Button onClick={() => void send()} disabled={!canSend}>
            {working && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />}
            Send {eligible.length > 0 ? eligible.length : ""} invitation
            {eligible.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** "2 already invited, 1 no longer an applicant for this job" */
function summarizeSkips(skipped: { reason: ScreenSkipReason }[]): string {
  const counts = new Map<ScreenSkipReason, number>();
  for (const s of skipped) counts.set(s.reason, (counts.get(s.reason) ?? 0) + 1);
  return [...counts.entries()].map(([reason, n]) => `${n} ${SKIP_LABEL[reason]}`).join(", ");
}
