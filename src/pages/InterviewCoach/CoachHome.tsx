import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import CoachShell from "@/components/interview-coach/shared/CoachShell";
import HeroBanner from "@/components/interview-coach/home/HeroBanner";
import { useInterviewSetupStore } from "@/stores/interviewSetupStore";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { useCoachAllowanceGate } from "@/hooks/useCoachAllowanceGate";
import { getPracticeJob, isPracticeJobUnavailable } from "@/lib/api/interviewCoach";
import { DEFAULT_CONFIG, coachLevelFromJob } from "@/data/interview-coach/constants";
import { defaultCallName } from "@/data/interview-coach/callName";

export default function CoachHome() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { requireAuth } = useAuthModal();
  const { guard } = useCoachAllowanceGate();
  const reset = useInterviewSetupStore((s) => s.reset);
  const setConfig = useInterviewSetupStore((s) => s.set);
  const openModal = useInterviewSetupStore((s) => s.openModal);
  const prefillFrom = useInterviewSetupStore((s) => s.prefillFrom);
  const handled = useRef(false);
  // Read when the link is handled, which may be after signing in.
  const userRef = useRef(user);
  userRef.current = user;
  // Likewise the allowance check: the job loads after the allowance may have.
  const guardRef = useRef(guard);
  guardRef.current = guard;

  /**
   * Deep link from an "you're moving forward" notification:
   * /interview-prep?role=Senior%20Engineer&company=Acme — prefill the setup
   * wizard with that exact role and open it, so prep is one click from the alert.
   */
  useEffect(() => {
    if (handled.current) return;
    const role = searchParams.get("role");
    if (!role || searchParams.get("job")) return;
    handled.current = true;

    reset();
    setConfig({ role });
    openModal();

    // Drop the params so a refresh doesn't reopen the wizard.
    const next = new URLSearchParams(searchParams);
    next.delete("role");
    next.delete("company");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, reset, setConfig, openModal]);

  /**
   * "Practice for this interview" from a job page: /interview-prep?job=<id>.
   *
   * The wizard opens on its review step, already set to the job's title,
   * level and skills — one click to start, every step still editable. The
   * server reads the posting itself when it plans the questions.
   */
  useEffect(() => {
    const jobId = searchParams.get("job");
    if (!jobId || handled.current || isLoading) return;
    handled.current = true;

    const next = new URLSearchParams(searchParams);
    next.delete("job");
    setSearchParams(next, { replace: true });

    requireAuth(() => {
      void getPracticeJob(jobId)
        .then((job) => {
          const experience = coachLevelFromJob(job.experienceLevel);
          const config = {
            ...DEFAULT_CONFIG,
            role: job.title,
            ...(experience ? { experience } : {}),
            focusSkills: job.skills.slice(0, 10),
            // The review step is shown straight away, so the name the
            // preferences step would suggest is filled in here — or, just
            // after signing in, once the account has loaded (below).
            callName: userRef.current ? defaultCallName(userRef.current) : undefined,
            practiceJob: { id: job.id, title: job.title, company: job.company },
          };
          reset();
          guardRef.current(() => {
            if (experience) {
              prefillFrom(config as Parameters<typeof prefillFrom>[0]);
            } else {
              // The posting doesn't say its level clearly; ask rather than guess.
              useInterviewSetupStore.setState({ config, step: 2, completed: [1], direction: 1 });
            }
            openModal();
          });
        })
        .catch((error) => {
          toast.error(
            isPracticeJobUnavailable(error)
              ? "Practice for a job opens once you've applied to it."
              : "Couldn't load that job. Please try again.",
          );
        });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, isLoading, isAuthenticated]);

  // Signing in from a job link can finish before the account has loaded.
  // Fill the greeting name in when it arrives, unless one was already chosen.
  useEffect(() => {
    if (!user) return;
    const { open, config, set } = useInterviewSetupStore.getState();
    if (open && config.practiceJob && config.callName === undefined) {
      set({ callName: defaultCallName(user) });
    }
  }, [user]);

  return (
    <CoachShell>
      <HeroBanner />
    </CoachShell>
  );
}
