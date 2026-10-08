import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import GeneratingReport from "@/components/interview-coach/session/GeneratingReport";
import QuestionStage from "@/components/interview-coach/session/QuestionStage";
import SessionToolbar from "@/components/interview-coach/session/SessionToolbar";
import TextAnswerFallback from "@/components/interview-coach/session/TextAnswerFallback";
import TranscriptPanel from "@/components/interview-coach/session/TranscriptPanel";
import { useMicLevel } from "@/hooks/useMicLevel";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useTextToSpeech } from "@/hooks/useTextToSpeech";
import {
  discardRecoverySnapshot,
  getRecoverySnapshot,
  recoverPartialReport,
  useInterviewSessionStore,
} from "@/stores/interviewSessionStore";
import { completeLiveScreen } from "@/lib/api/aiScreen";
import { completeSession, getSession } from "@/lib/api/interviewCoach";

const SILENCE_MS = 4000; // auto-finish after this much quiet…
const MIN_ANSWER_MS = 10_000; // …but never before the answer is at least this old
/**
 * If the mic is live this long without a single recognised word, something is
 * wrong (muted at the OS level, wrong input device, STT service unreachable).
 * Auto-finish can't rescue this — it requires a non-empty buffer — so without
 * this check the candidate waits in "listening" forever with no feedback.
 */
const NO_SPEECH_MS = 9000;

export default function InterviewSession() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const s = useInterviewSessionStore();
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  /** Screening only: scoring the run and handing it to the employer. */
  const [submitting, setSubmitting] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [reconnectError, setReconnectError] = useState<string | null>(null);

  const isActiveSession = !!id && s.sessionId === id;
  const snapshot = !isActiveSession && id ? getRecoverySnapshot() : null;
  const recoverable = !!snapshot && snapshot.sessionId === id && snapshot.answers.length > 0;

  useEffect(() => {
    if (!id || isActiveSession) return;
    const local = getRecoverySnapshot();
    if (local?.sessionId === id && local.serverBacked === false) return;
    let cancelled = false;
    setReconnectError(null);
    void (async () => {
      let session = await getSession(id);
      if (cancelled) return;
      if (session.status === "completed") {
        navigate(`/interview-prep/report/${id}`, { replace: true });
        return;
      }
      if (session.status !== "active") {
        navigate("/interview-prep", { replace: true });
        return;
      }
      if (session.report) {
        await completeSession(id);
        if (!cancelled) navigate(`/interview-prep/report/${id}`, { replace: true });
        return;
      }
      if (!cancelled) await useInterviewSessionStore.getState().resumeFromServer(session);
    })().catch((error: Error) => {
      if (!cancelled) setReconnectError(error.message || "Couldn't reconnect to this interview.");
    });
    return () => { cancelled = true; };
  }, [id, isActiveSession, reconnectAttempt, navigate]);

  // ─── Voice: AI speech (TTS) ────────────────────────────────────────────────
  const tts = useTextToSpeech();
  const onAISpeechEnd = s.onAISpeechEnd;

  useEffect(() => {
    if (!isActiveSession || s.aiState !== "speaking" || !s.utterance) return;
    const state = useInterviewSessionStore.getState();

    // Silent only when muted or NEITHER voice path is available.
    if (state.muted || (!tts.supported && !tts.neural)) {
      // Silent mode: show the text, pace by reading length.
      const ms = Math.min(9000, Math.max(1800, s.utterance.text.length * 42));
      const t = setTimeout(onAISpeechEnd, ms);
      return () => clearTimeout(t);
    }

    tts.speak(s.utterance.text, {
      rate: state.config?.speechRate ?? 1,
      voiceURI: state.config?.voiceURI,
      lang: state.config?.language,
      onEnd: onAISpeechEnd,
    });
    // Watchdog: speechSynthesis can stall silently (no voices, headless, OS
    // quirks). If onend never fires, advance anyway after a generous window.
    const watchdog = setTimeout(
      onAISpeechEnd,
      Math.min(30_000, Math.max(6000, s.utterance.text.length * 70)),
    );
    return () => {
      clearTimeout(watchdog);
      tts.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActiveSession, s.utterance?.seq, s.aiState, s.muted]);

  // Stop talking the moment we pause or leave.
  useEffect(() => {
    if (s.aiState === "paused" || s.aiState === "evaluating") tts.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.aiState]);

  // ─── Voice: candidate speech (STT) ─────────────────────────────────────────
  const lastActivityRef = useRef(Date.now());
  const appendFinalChunk = s.appendFinalChunk;

  const stt = useSpeechRecognition({
    lang: s.config?.language ?? "en-US",
    onResult: useCallback(
      (finalText: string) => {
        lastActivityRef.current = Date.now();
        appendFinalChunk(finalText);
      },
      [appendFinalChunk],
    ),
  });

  // Unsupported browser → typing mode, once.
  useEffect(() => {
    if (isActiveSession && !stt.supported && !s.textMode) {
      s.setTextMode(true);
      toast.info("Voice input isn't supported in this browser — typing mode enabled.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActiveSession, stt.supported]);

  // Requested typed answers → start there, rather than making someone discover
  // the fallback mid-interview. Silent: they asked for this, it isn't news.
  const startTyped = s.config?.startTyped;
  useEffect(() => {
    if (isActiveSession && startTyped) useInterviewSessionStore.getState().setTextMode(true);
  }, [isActiveSession, startTyped]);

  // Permission errors → typing mode with guidance.
  useEffect(() => {
    if (stt.error === "not-allowed" || stt.error === "audio-capture") {
      if (!s.micDenied) {
        s.setMicDenied(true);
        toast.error("Microphone unavailable — switched to typing mode.", {
          description: "Enable mic access in your browser's site settings to talk instead.",
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stt.error]);

  const shouldListen = isActiveSession && s.aiState === "listening" && !s.textMode && !s.micDenied;

  // Start/stop recognition with the machine, and restart when Chrome drops it.
  useEffect(() => {
    if (!stt.supported) return;
    if (shouldListen && !stt.listening) {
      const t = setTimeout(() => stt.start(), 250);
      return () => clearTimeout(t);
    }
    if (!shouldListen && stt.listening) stt.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldListen, stt.listening]);

  // Interim speech counts as activity.
  useEffect(() => {
    if (stt.interim) lastActivityRef.current = Date.now();
  }, [stt.interim]);

  // ─── "We can't hear you" ──────────────────────────────────────────────────
  // Tracks whether the mic has produced ANY recognised speech this turn.
  const [deaf, setDeaf] = useState(false);
  const heardRef = useRef(false);

  useEffect(() => {
    if (stt.interim || s.answerBuffer.trim()) {
      heardRef.current = true;
      setDeaf(false);
    }
  }, [stt.interim, s.answerBuffer]);

  useEffect(() => {
    if (!shouldListen) {
      // New turn — reset and let it prove itself again.
      heardRef.current = false;
      setDeaf(false);
      return;
    }
    const t = setTimeout(() => {
      if (!heardRef.current) setDeaf(true);
    }, NO_SPEECH_MS);
    return () => clearTimeout(t);
  }, [shouldListen, s.questionIndex]);

  // Chrome fires this when it hears nothing at all — same remedy.
  useEffect(() => {
    if (stt.error === "no-speech") setDeaf(true);
  }, [stt.error]);

  // ─── Mic waveform ──────────────────────────────────────────────────────────
  const mic = useMicLevel({ deviceId: s.config?.micDeviceId, enabled: shouldListen });

  // ─── Clock: session timer, answer timer, silence auto-finish ──────────────
  const finishAnswer = s.finishAnswer;
  useEffect(() => {
    if (!isActiveSession) return;
    const t = setInterval(() => {
      useInterviewSessionStore.getState().tick();

      const st = useInterviewSessionStore.getState();
      // A requested extra-time adjustment has to change the interview, not just
      // be recorded: thinking pauses must not be read as "finished answering".
      const extra = st.config?.extraTime ? 2 : 1;
      if (
        st.aiState === "listening" &&
        !st.textMode &&
        st.answerBuffer.trim() &&
        st.answerStartedAt &&
        Date.now() - st.answerStartedAt > MIN_ANSWER_MS * extra &&
        Date.now() - lastActivityRef.current > SILENCE_MS * extra
      ) {
        void finishAnswer();
      }
    }, 500);
    return () => clearInterval(t);
  }, [isActiveSession, finishAnswer]);

  // ─── Completion → report (practice) or submission (employer screening) ─────
  const screenId = s.config?.screenMode ? s.config.screenId : undefined;
  useEffect(() => {
    if (!s.completedEntryId) return;

    if (!screenId) {
      navigate(`/interview-prep/report/${s.completedEntryId}`, { replace: true });
      return;
    }

    // A screening is only really finished once the employer has the scorecard,
    // so land the candidate on the screening page either way and let it show
    // the true state rather than claiming success here.
    let cancelled = false;
    setSubmitting(true);
    completeLiveScreen(screenId)
      .catch((e: Error) => {
        if (!cancelled) toast.error(e.message || "Couldn't submit your interview");
      })
      .finally(() => {
        if (!cancelled) navigate(`/ai-screen/${screenId}`, { replace: true });
      });
    return () => {
      cancelled = true;
    };
  }, [s.completedEntryId, screenId, navigate]);

  // Ended-with-nothing (discard) → back home.
  useEffect(() => {
    if (isActiveSession && s.aiState === "idle" && !s.completedEntryId && s.startedAt) {
      navigate("/interview-prep", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.aiState]);

  // Reset the machine when leaving the screen.
  useEffect(() => {
    return () => {
      const st = useInterviewSessionStore.getState();
      if (st.aiState !== "evaluating") st.reset();
    };
    
  }, []);

  // ─── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.isContentEditable) return;
      const st = useInterviewSessionStore.getState();
      if (e.code === "Space" && st.aiState === "listening" && st.answerBuffer.trim() && !st.textMode) {
        e.preventDefault();
        void st.finishAnswer();
      } else if (e.key === "Escape") {
        if (st.aiState === "paused") st.resume();
        else st.pause();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ─── Guards ────────────────────────────────────────────────────────────────
  if (!isActiveSession) {
    if (recoverable && snapshot?.serverBacked === false) {
      return (
        <div className="booth-light min-h-screen bg-booth">
          <AlertDialog open>
            <AlertDialogContent className="border-ink/10 bg-surface text-ink">
              <AlertDialogHeader>
                <AlertDialogTitle>This interview was interrupted</AlertDialogTitle>
                <AlertDialogDescription className="text-ink-dim">
                  You answered {snapshot.answers.length} question
                  {snapshot.answers.length > 1 ? "s" : ""} for the {snapshot.config.role} session
                  before it stopped. Nova can grade what you completed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel
                  onClick={() => {
                    discardRecoverySnapshot();
                    navigate("/interview-prep", { replace: true });
                  }}
                  className="border-ink/15 bg-transparent text-ink hover:bg-surface-2 hover:text-ink"
                >
                  Discard
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    const entry = recoverPartialReport(snapshot);
                    navigate(`/interview-prep/report/${entry.id}`, { replace: true });
                  }}
                  className="bg-coral text-white hover:bg-coral/90"
                >
                  Grade partial interview
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      );
    }
    return (
      <div className="booth-light flex min-h-screen flex-col items-center justify-center gap-4 bg-booth px-6 text-center text-ink">
        <p>{reconnectError ?? "Reconnecting to your interview…"}</p>
        {reconnectError && (
          <div className="flex gap-3">
            <Button onClick={() => setReconnectAttempt((n) => n + 1)}>Try again</Button>
            {recoverable && snapshot && (
              <Button variant="outline" onClick={() => {
                const entry = recoverPartialReport(snapshot);
                navigate(`/interview-prep/report/${entry.id}`, { replace: true });
              }}>Grade saved answers locally</Button>
            )}
            <Button variant="outline" onClick={() => navigate("/interview-prep", { replace: true })}>Back to coach</Button>
          </div>
        )}
      </div>
    );
  }

  if (s.aiState === "evaluating" || submitting) return <GeneratingReport />;

  const listening = s.aiState === "listening";

  const submitTyped = (text: string) => {
    useInterviewSessionStore.setState({ answerBuffer: text });
    void s.finishAnswer();
  };

  return (
    // pt-16 clears the fixed header, which is out of flow. The page scrolls so
    // the footer sits below the fold rather than eating the booth's height.
    <div className="booth-light flex min-h-screen flex-col bg-booth pt-16 text-ink">
      <Header />

      {/* Error banner */}
      {s.error && s.aiState === "error" && (
        <div className="border-b border-rose-500/30 bg-rose-500/10 px-6 py-2 text-center text-sm text-rose-300">
          {s.error}{" "}
          <button onClick={s.resume} className="font-semibold underline underline-offset-2">
            Try again
          </button>
        </div>
      )}

      {/* Fills the first viewport (minus the fixed header) so the booth still
          reads full-screen and the footer lands below it. */}
      <section
        className="relative flex h-[calc(100vh-4rem)] min-h-0 flex-col"
        aria-label="Interview conversation"
      >
        <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
          <div className="flex min-h-full flex-col items-center justify-center py-8">
            <QuestionStage aiState={s.aiState} micDataRef={mic.dataRef} />

            {listening && s.textMode && (
              <div className="mt-4 w-full px-6">
                <div className="mx-auto max-w-2xl">
                  <TextAnswerFallback onSubmit={submitTyped} />
                </div>
              </div>
            )}

            {/* Mic is live but nothing is coming through — say so and offer a
                way forward, instead of leaving them stuck in "listening". */}
            {listening && !s.textMode && deaf && (
              <div className="mt-4 w-full px-6">
                <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 rounded-2xl border border-ink/15 bg-surface px-5 py-4 text-center">
                  <p className="text-sm font-medium text-ink">We can't hear you</p>
                  <p className="text-xs text-ink-dim">
                    Check that the right microphone is selected and unmuted — or answer in writing
                    and carry on.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button size="sm" variant="coral" onClick={() => s.setTextMode(true)}>
                      Type my answer instead
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        heardRef.current = false;
                        setDeaf(false);
                        stt.stop();
                      }}
                    >
                      Retry microphone
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Part of the centered stack, so it tracks the bar instead of
                being pushed to the bottom of the viewport. */}
            <div className="mt-5 flex justify-center px-4">
              <SessionToolbar
                aiState={s.aiState}
                muted={s.muted}
                textMode={s.textMode}
                canFinish={!!s.answerBuffer.trim()}
                onFinishAnswer={() => void s.finishAnswer()}
                onToggleMute={() => {
                  if (!s.muted && s.aiState === "speaking") tts.cancel();
                  s.setMuted(!s.muted);
                }}
                onPauseResume={() => (s.aiState === "paused" ? s.resume() : s.pause())}
                onReplay={s.replayQuestion}
                onOpenTranscript={() => setTranscriptOpen(true)}
                onEnd={() => void s.endEarly()}
                answersCount={s.answers.length}
              />
            </div>
          </div>
        </div>
      </section>

      <Footer />

      <TranscriptPanel
        open={transcriptOpen}
        onOpenChange={setTranscriptOpen}
        transcript={s.transcript}
        onToggleBookmark={s.toggleBookmark}
      />
    </div>
  );
}
