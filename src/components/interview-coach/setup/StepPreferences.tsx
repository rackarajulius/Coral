import { useEffect, useMemo, useState } from "react";
import { Mic, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { useAudioInputs, useMicLevel } from "@/hooks/useMicLevel";
import { useTextToSpeech } from "@/hooks/useTextToSpeech";
import {
  DURATION_OPTIONS,
  LANGUAGES,
  QUESTION_COUNT_OPTIONS,
} from "@/data/interview-coach/constants";
import { useInterviewSetupStore } from "@/stores/interviewSetupStore";
import { useAuth } from "@/contexts/AuthContext";
import {
  CALL_NAME_MAX,
  defaultCallName,
  salutation,
  sanitizeCallName,
} from "@/data/interview-coach/callName";

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-2xl border border-ink/10 bg-surface p-5", className)}>
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-dim">{label}</p>
      {children}
    </div>
  );
}

const selectTriggerCls =
  "w-full border-ink/15 bg-surface-2 text-ink focus:ring-coral [&>svg]:text-ink-dim";
const selectContentCls = "booth-light border-ink/10 bg-surface text-ink";

export default function StepPreferences() {
  const config = useInterviewSetupStore((s) => s.config);
  const set = useInterviewSetupStore((s) => s.set);

  const { voices, speak, speaking, neural, neuralVoices } = useTextToSpeech();
  const englishVoices = useMemo(
    () => voices.filter((v) => v.lang.toLowerCase().startsWith("en")).slice(0, 12),
    [voices],
  );

  /**
   * Studio voices when they're available, otherwise whatever this browser
   * ships. The two lists are unrelated, so a selection made against one is
   * discarded when the other is live — showing a stale name the interview
   * wouldn't actually use is worse than falling back to the default.
   */
  const voiceOptions = useMemo(
    () =>
      neural
        ? neuralVoices.map((v) => ({ value: v.id, label: v.label, hint: v.description }))
        : englishVoices.map((v) => ({ value: v.voiceURI, label: v.name, hint: "" })),
    [neural, neuralVoices, englishVoices],
  );
  const selectedVoice = voiceOptions.some((o) => o.value === config.voiceURI)
    ? (config.voiceURI as string)
    : "auto";

  // Mic test: request permission on demand so denial surfaces before the session.
  const [testingMic, setTestingMic] = useState(false);
  const { level, error: micError, active } = useMicLevel({
    deviceId: config.micDeviceId,
    enabled: testingMic,
  });
  const devices = useAudioInputs(active); // labels appear after permission

  const { user } = useAuth();

  // Prefilled once, and only when nothing has been chosen: an empty string is
  // a decision ("don't use my name") and must survive coming back to this step
  // or "Practice again".
  useEffect(() => {
    if (config.callName === undefined) set({ callName: defaultCallName(user) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const speakAs = (text: string) =>
    speak(text, {
      voiceURI: selectedVoice === "auto" ? undefined : selectedVoice,
      rate: config.speechRate,
      lang: config.language,
    });

  const previewVoice = () =>
    speakAs(`${salutation(config.callName)}, I'm Nova. This is how I'll sound during your interview.`);

  const callName = config.callName ?? "";

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="What Nova calls you" className="sm:col-span-2">
        <div className="flex gap-2">
          <Input
            value={callName}
            onChange={(e) => set({ callName: sanitizeCallName(e.target.value) })}
            // Trailing spaces are allowed while typing so "Mary Ann" can be
            // entered; they are trimmed here.
            onBlur={() => set({ callName: callName.trim() })}
            placeholder="No name — Nova just says hi"
            maxLength={CALL_NAME_MAX}
            autoComplete="off"
            aria-label="What Nova calls you"
            className="h-10 border-ink/15 bg-surface-2 text-ink placeholder:text-ink-dim focus-visible:ring-coral"
          />
          <Button
            variant="outline"
            onClick={() => speakAs(`${salutation(callName)}, I'm Nova, your interview coach today.`)}
            disabled={speaking}
            className="shrink-0 border-ink/15 bg-surface-2 text-ink hover:bg-coral hover:text-white"
          >
            <Volume2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Hear it
          </Button>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-ink-dim">
          One name, used in the greeting. Try a short form, or spell it the way it sounds if the
          voice gets it wrong — Nova says exactly what's here. Leave it empty to skip the name.
        </p>
      </Field>

      <Field label="Language">
        <Select value={config.language} onValueChange={(v) => set({ language: v })}>
          <SelectTrigger className={selectTriggerCls} aria-label="Interview language">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className={selectContentCls}>
            {LANGUAGES.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Interviewer voice">
        <div className="flex gap-2">
          <Select
            value={selectedVoice}
            onValueChange={(v) => set({ voiceURI: v === "auto" ? undefined : v })}
          >
            <SelectTrigger className={selectTriggerCls} aria-label="Interviewer voice">
              <SelectValue placeholder="Default" />
            </SelectTrigger>
            <SelectContent className={selectContentCls}>
              <SelectItem value="auto">Default</SelectItem>
              {voiceOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                  {o.hint && <span className="ml-2 text-xs text-ink-dim">{o.hint}</span>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={previewVoice}
            disabled={speaking}
            aria-label="Preview interviewer voice"
            className="shrink-0 border-ink/15 bg-surface-2 text-ink hover:bg-coral hover:text-white"
          >
            <Volume2 className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-ink-dim">
          {neural
            ? "Studio voices — press play to hear each one."
            : voiceOptions.length
              ? "Using your browser's built-in voices — the choices depend on your device."
              : "Your browser reports no speech voices, so Nova's questions will appear as text only."}
        </p>
      </Field>

      <Field label="Session length">
        <Select
          value={String(config.durationMin)}
          onValueChange={(v) => set({ durationMin: Number(v) })}
        >
          <SelectTrigger className={selectTriggerCls} aria-label="Session length">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className={selectContentCls}>
            {DURATION_OPTIONS.map((d) => (
              <SelectItem key={d} value={String(d)}>
                ~{d} minutes
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Questions">
        <Select
          value={String(config.questionCount)}
          onValueChange={(v) => set({ questionCount: Number(v) })}
        >
          <SelectTrigger className={selectTriggerCls} aria-label="Number of questions">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className={selectContentCls}>
            {QUESTION_COUNT_OPTIONS.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n} questions
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label={`Speaking speed · ${config.speechRate?.toFixed(2)}x`}>
        <Slider
          value={[config.speechRate ?? 1]}
          min={0.8}
          max={1.2}
          step={0.05}
          onValueChange={([v]) => set({ speechRate: v })}
          aria-label="Interviewer speaking speed"
          className="[&_[role=slider]]:border-coral [&_[role=slider]]:bg-coral"
        />
        <div className="mt-2 flex justify-between text-[11px] text-ink-dim">
          <span>Calm</span>
          <span>Natural</span>
          <span>Brisk</span>
        </div>
      </Field>

      <Field label="Microphone">
        <div className="space-y-3">
          <Select
            value={config.micDeviceId ?? "default"}
            onValueChange={(v) => set({ micDeviceId: v === "default" ? undefined : v })}
          >
            <SelectTrigger className={selectTriggerCls} aria-label="Microphone">
              <SelectValue placeholder="Default microphone" />
            </SelectTrigger>
            <SelectContent className={selectContentCls}>
              <SelectItem value="default">Default microphone</SelectItem>
              {devices
                .filter((d) => d.deviceId && d.deviceId !== "default")
                .map((d) => (
                  <SelectItem key={d.deviceId} value={d.deviceId}>
                    {d.label || "Microphone"}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>

          {testingMic && !micError ? (
            <div className="flex items-center gap-3">
              <Mic className={cn("h-4 w-4 shrink-0", active ? "text-state-listening" : "text-ink-dim")} aria-hidden="true" />
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-state-listening transition-[width] duration-100"
                  style={{ width: `${Math.round(level * 100)}%` }}
                />
              </div>
              <button onClick={() => setTestingMic(false)} className="text-xs text-ink-dim hover:text-ink">
                Stop
              </button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTestingMic(true)}
              className="border-ink/15 bg-surface-2 text-xs text-ink hover:bg-coral hover:text-white"
            >
              <Mic className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Test microphone
            </Button>
          )}
          {micError && (
            <p className="text-xs text-rose-400">
              {micError === "NotAllowedError"
                ? "Microphone access was blocked — you can still interview in typing mode, or enable the mic in your browser's site settings."
                : "No microphone found — typing mode will be used."}
            </p>
          )}
        </div>
      </Field>

    </div>
  );
}
