import { ReactNode, useState } from "react";
import {
  Check,
  Pause,
  Play,
  RotateCcw,
  ScrollText,
  Square,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type { AIState } from "@/data/interview-coach/types";

function ToolButton({
  onClick,
  label,
  icon,
  tone = "default",
  disabled,
  active,
}: {
  onClick: () => void;
  label: string;
  icon: ReactNode;
  tone?: "default" | "danger" | "primary";
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "flex flex-col items-center gap-1 rounded-2xl px-3 py-2 text-[10px] font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral",
        "disabled:pointer-events-none disabled:opacity-35",
        tone === "danger" && "text-rose-400 hover:bg-rose-500/10",
        tone === "primary" && "bg-state-listening/15 text-state-listening hover:bg-state-listening/25",
        tone === "default" && (active ? "bg-surface-2 text-ink" : "text-ink-dim hover:bg-surface-2 hover:text-ink"),
      )}
    >
      <span className="grid h-6 w-6 place-items-center">{icon}</span>
      {label}
    </button>
  );
}

export default function SessionToolbar({
  aiState,
  muted,
  textMode,
  canFinish,
  onFinishAnswer,
  onToggleMute,
  onPauseResume,
  onReplay,
  onOpenTranscript,
  onEnd,
  answersCount,
}: {
  aiState: AIState;
  muted: boolean;
  textMode: boolean;
  canFinish: boolean;
  onFinishAnswer: () => void;
  onToggleMute: () => void;
  onPauseResume: () => void;
  onReplay: () => void;
  onOpenTranscript: () => void;
  onEnd: () => void;
  answersCount: number;
}) {
  const [confirmEnd, setConfirmEnd] = useState(false);
  const paused = aiState === "paused";
  const listening = aiState === "listening";

  return (
    <>
      <div className="flex items-center justify-center gap-1 rounded-3xl border border-gray-300 bg-surface/90 px-3 py-2 ">
        {/* Done answering — the hero action while listening */}
        {listening && !textMode && (
          <ToolButton
            onClick={onFinishAnswer}
            disabled={!canFinish}
            label="Done"
            tone="primary"
            icon={<Check className="h-4 w-4" />}
          />
        )}

        <ToolButton
          onClick={onToggleMute}
          label={muted ? "Unmute AI" : "Mute AI"}
          active={muted}
          icon={muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        />

        <ToolButton
          onClick={onReplay}
          label="Replay"
          disabled={!(listening || aiState === "speaking" || paused)}
          icon={<RotateCcw className="h-4 w-4" />}
        />

        <ToolButton
          onClick={onPauseResume}
          label={paused ? "Resume" : "Pause"}
          disabled={!(paused || listening || aiState === "speaking" || aiState === "error")}
          icon={paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
        />

        <ToolButton
          onClick={onOpenTranscript}
          label="Transcript"
          icon={<ScrollText className="h-4 w-4" />}
        />

        <span className="mx-1 h-8 w-px bg-ink/10" aria-hidden="true" />

        <ToolButton
          onClick={() => setConfirmEnd(true)}
          label="End"
          tone="danger"
          icon={<Square className="h-4 w-4" />}
        />
      </div>

      <AlertDialog open={confirmEnd} onOpenChange={setConfirmEnd}>
        <AlertDialogContent className="border border-gray-300 bg-card text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>End this interview?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {answersCount >= 1
                ? `You've answered ${answersCount} question${answersCount > 1 ? "s" : ""} — Nova will grade what you've done so far and build a report.`
                : "You haven't answered anything yet, so this session will be discarded."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border border-gray-300 bg-white text-foreground hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 h-9 rounded-full px-3">
              Keep going
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={onEnd}
              className={cn(
                "h-9 rounded-full px-3 text-white",
                answersCount >= 1
                  ? "bg-coral hover:bg-coral/90"
                  : "bg-destructive hover:bg-destructive/90",
              )}
            >
              {answersCount >= 1 ? "End & get report" : "Discard session"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
