import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useProfile } from "@/contexts/ProfileContext";
import type { AIState } from "@/data/interview-coach/types";
import AIOrb from "../shared/AIOrb";
import WaveformBars, { type WaveVariant } from "../shared/WaveformBars";

interface Tone {
  border: string;
  dot: string;
}

const AI_TONE: Tone = {
  border: "border-gray-300",
  dot: "bg-state-speaking",
};

const YOU_TONE: Tone = {
  border: "border-gray-300",
  dot: "bg-state-listening",
};

/** Mirrored equalizer flanking an avatar; dims when its speaker has the floor. */
function FlankingWave({
  variant,
  dataRef,
  active,
  flip,
}: {
  variant: WaveVariant;
  dataRef?: React.RefObject<Uint8Array | null>;
  active: boolean;
  flip?: boolean;
}) {
  return (
    <div
      className={cn(
        "hidden w-12 shrink-0 transition-opacity duration-500 sm:block md:w-16",
        active ? "opacity-100" : "opacity-20",
        flip && "-scale-x-100",
      )}
    >
      <WaveformBars variant={variant} dataRef={dataRef} bars={7} height={44} />
    </div>
  );
}

/** Shared card chrome: accent border and tint while its speaker holds the floor. */
function SpeakerCard({
  tone,
  active,
  children,
}: {
  tone: Tone;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <article
      className={cn(
        "flex flex-col rounded-xl border bg-card p-5 text-center transition-all duration-500 md:p-6",
        active ? tone.border : "border-ink/10",
      )}
    >
      {children}
    </article>
  );
}

/** Name + role beneath an avatar. */
function Identity({ name, role, roleClass }: { name: string; role: string; roleClass?: string }) {
  return (
    <>
      <p className="truncate font-display text-lg font-semibold text-ink">{name}</p>
      <p className={cn("mt-0.5 text-xs", roleClass ?? "text-ink-dim")}>{role}</p>
    </>
  );
}

/**
 * Center stage: the interviewer and the candidate side by side, each with a
 * live avatar and waveform reflecting whose turn it is. The full transcript
 * lives in TranscriptPanel.
 */
export default function QuestionStage({
  aiState,
  micDataRef,
}: {
  aiState: AIState;
  micDataRef?: React.RefObject<Uint8Array | null>;
}) {
  const { profile } = useProfile();
  const avatarUrl = profile.avatarUrl;

  const listening = aiState === "listening";
  const speaking = aiState === "speaking";
  const busy = aiState === "thinking" || aiState === "evaluating";

  // Each side idles unless it holds the floor, so only one card animates at a time.
  const aiWave: WaveVariant = speaking ? "speaking" : busy ? "thinking" : "idle";
  const youWave: WaveVariant = listening ? "listening" : "idle";
  const youName = profile.name?.trim() || "You";
  const youInitial = youName.charAt(0).toUpperCase();

  const aiStatus = speaking
    ? "Nova is speaking…"
    : busy
      ? "Analyzing your answer…"
      : aiState === "connecting"
        ? "Joining the interview…"
        : aiState === "paused"
          ? "Paused"
          : "Waiting for your answer";

  return (
    <div className="grid w-full max-w-4xl gap-4 px-4 lg:grid-cols-2">
      {/* ─── Interviewer ─────────────────────────────────────────────────── */}
      <SpeakerCard tone={AI_TONE} active={speaking}>
        <div className="flex items-center justify-center gap-2">
          <FlankingWave variant={aiWave} active={speaking} />
          <AIOrb state={aiState} size={92} />
          <FlankingWave variant={aiWave} active={speaking} flip />
        </div>

        <div className="mt-2 min-w-0">
          <Identity name="Nova" role="Senior Hiring Manager" />
        </div>

        <p
          className="mt-4 flex items-center justify-center gap-2 text-xs text-ink-dim"
          role="status"
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              speaking ? AI_TONE.dot : "bg-state-idle",
              speaking && "animate-pulse motion-reduce:animate-none",
            )}
            aria-hidden="true"
          />
          {aiStatus}
        </p>
      </SpeakerCard>

      {/* ─── Candidate ───────────────────────────────────────────────────── */}
      <SpeakerCard tone={YOU_TONE} active={listening}>
        <div className="flex items-center justify-center gap-2">
          <FlankingWave variant={youWave} dataRef={micDataRef} active={listening} />
          <div
            className="relative grid shrink-0 place-items-center"
            style={{ width: 138, height: 138 }}
            aria-hidden="true"
          >
            <div
              className={cn(
                "absolute rounded-full blur-2xl transition-colors duration-700",
                listening ? "bg-emerald-400/20" : "bg-slate-400/10",
              )}
              style={{ width: 118, height: 118 }}
            />
            <div
              className={cn(
                "relative grid h-[92px] w-[92px] place-items-center overflow-hidden rounded-full ring-2 transition-all duration-500",
                listening ? "ring-state-listening" : "ring-ink/15",
              )}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center bg-gradient-to-br from-sky-400 to-blue-600 font-display text-3xl font-semibold text-white">
                  {youInitial}
                </div>
              )}
            </div>
          </div>
          <FlankingWave variant={youWave} dataRef={micDataRef} active={listening} flip />
        </div>

        <div className="mt-2 min-w-0">
          <Identity name={youName} role="You" roleClass="text-state-listening" />
        </div>

        {listening && (
          <p className="mt-4 flex items-center justify-center gap-2 text-xs text-ink-dim">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full animate-pulse motion-reduce:animate-none",
                YOU_TONE.dot,
              )}
              aria-hidden="true"
            />
            Listening…
          </p>
        )}
      </SpeakerCard>
    </div>
  );
}
