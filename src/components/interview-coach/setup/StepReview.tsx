import { Briefcase, Clock, ListChecks, Sparkles, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DIFFICULTY_LEVELS,
  EXPERIENCE_LEVELS,
  INTERVIEW_TYPES,
  LANGUAGES,
  PER_QUESTION_OVERHEAD_SEC,
  competencyLabel,
} from "@/data/interview-coach/constants";
import { useInterviewSetupStore } from "@/stores/interviewSetupStore";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-ink/5 py-2.5 text-sm last:border-0">
      <span className="text-ink-dim">{label}</span>
      <span className="text-right font-medium text-ink">{value}</span>
    </div>
  );
}

export default function StepReview() {
  const config = useInterviewSetupStore((s) => s.config);
  const setConfig = useInterviewSetupStore((s) => s.set);
  const job = config.practiceJob;

  const type = INTERVIEW_TYPES.find((t) => t.id === config.type);
  const experience = EXPERIENCE_LEVELS.find((l) => l.id === config.experience);
  const difficulty = DIFFICULTY_LEVELS.find((l) => l.id === config.difficulty);
  const language = LANGUAGES.find((l) => l.id === config.language);

  const questionCount = config.questionCount ?? 6;
  // ~105s spoken answer + thinking/transition overhead per question
  const estMinutes = Math.round((questionCount * (105 + PER_QUESTION_OVERHEAD_SEC)) / 60);
  const followUps = Math.ceil(questionCount / 3);

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      {/* Config summary */}
      <div className="rounded-2xl border border-ink/10 bg-surface p-6 lg:col-span-3">
        <p className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-dim">
          <User className="h-3.5 w-3.5 text-coral" aria-hidden="true" /> Your session
        </p>
        <Row label="Nova calls you" value={config.callName?.trim() || "No name"} />
        {job && (
          <Row label="Practising for" value={job.company ? `${job.title} · ${job.company}` : job.title} />
        )}
        <Row label="Target role" value={config.role ?? "—"} />
        <Row label="Experience" value={experience?.label ?? "—"} />
        <Row label="Interview type" value={type?.label ?? "—"} />
        <Row
          label="Difficulty"
          value={`${difficulty?.label ?? "—"}${config.adaptive ? " · Adaptive" : ""}`}
        />
        <Row label="Language" value={language?.label ?? "—"} />
        <Row label="Questions" value={`${questionCount} main + up to ${followUps} follow-ups`} />
        <Row
          label="Resume"
          value={config.resume ? config.resume.fileName : "Not provided"}
        />
        {config.focusSkills && config.focusSkills.length > 0 && (
          <Row label="Focus skills" value={config.focusSkills.join(", ")} />
        )}
      </div>

      <div className="space-y-4 lg:col-span-2">
        {/* The job this run is built around */}
        {job && (
          <div className="rounded-2xl border border-coral/30 bg-coral/10 p-6">
            <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-coral">
              <Briefcase className="h-3.5 w-3.5" aria-hidden="true" /> Based on the job posting
            </p>
            <p className="text-xs leading-relaxed text-ink-dim">
              Nova reads this job&apos;s responsibilities and requirements and asks what
              {job.company ? ` ${job.company}` : " the employer"} is likely to ask.
            </p>
            <button
              type="button"
              onClick={() => setConfig({ practiceJob: undefined })}
              className="mt-3 text-xs font-medium text-ink underline-offset-4 hover:underline"
            >
              Practise without this job
            </button>
          </div>
        )}

        {/* Estimate */}
        <div className="rounded-2xl border border-ink/10 bg-surface p-6">
          <p className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-dim">
            <Clock className="h-3.5 w-3.5 text-coral" aria-hidden="true" /> Estimated
          </p>
          <p className="font-display text-3xl font-semibold text-ink">~{estMinutes} min</p>
          <p className="mt-1 text-xs text-ink-dim">
            Voice conversation with live coaching and a full report at the end.
          </p>
        </div>

        {/* Evaluation categories */}
        <div className="rounded-2xl border border-ink/10 bg-surface p-6">
          <p className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-dim">
            <ListChecks className="h-3.5 w-3.5 text-coral" aria-hidden="true" /> You'll be scored on
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(type?.competencies ?? []).map((c) => (
              <Badge key={c} variant="secondary" className="font-medium">
                {competencyLabel(c)}
              </Badge>
            ))}
          </div>
        </div>

        {/* Resume insight */}
        {config.resume && (
          <div className="rounded-2xl border border-coral/30 bg-coral/10 p-6">
            <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-coral">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Personalized
            </p>
            <p className="text-xs leading-relaxed text-ink-dim">
              Nova will weave your {config.resume.skills.slice(0, 3).join(", ")} background into
              the questions.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
