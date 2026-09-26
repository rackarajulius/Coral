import { useEffect, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Sparkles, Loader2, CheckCircle2, ArrowLeft, Video, Circle, Square, RotateCcw, Upload, VideoOff, Mic,
} from "lucide-react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  getMyScreen, submitScreen, declineScreen, uploadScreenVideo, consentToLiveScreen,
  startLiveScreen, type CandidateScreen,
} from "@/lib/api/aiScreen";
import { AccommodationsRequest } from "@/components/jobSeeker/AccommodationsRequest";
import { useIntegritySignals } from "@/hooks/useIntegritySignals";
import { useInterviewSessionStore } from "@/stores/interviewSessionStore";
import { ScreenFeedbackPanel } from "@/components/interview-coach/ScreenFeedbackPanel";
import type { InterviewConfig } from "@/data/interview-coach/types";

const AiScreen = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [answers, setAnswers] = useState<string[]>([]);

  const { data: screen, isLoading, isError, error } = useQuery({
    queryKey: ["ai-screen", id],
    queryFn: () => getMyScreen(id!),
    enabled: !!id,
    retry: false,
  });

  useEffect(() => {
    if (screen) setAnswers(Array(screen.questions.length).fill(""));
  }, [screen]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["ai-screen", id] });

  // Context for the human reviewer, never scored — see useIntegritySignals.
  const integrity = useIntegritySignals();

  const submitMut = useMutation({
    mutationFn: () => submitScreen(id!, answers, integrity.collect()),
    onSuccess: () => {
      toast.success("Screening submitted", { description: "Your answers were sent to the employer." });
      invalidate();
    },
    onError: (e) => toast.error((e as Error).message || "Couldn't submit"),
  });

  const declineMut = useMutation({
    mutationFn: () => declineScreen(id!),
    onSuccess: () => {
      toast("Screening declined");
      invalidate();
    },
  });

  const allAnswered = answers.length > 0 && answers.every((a) => a.trim().length > 0);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-6 pt-24">
        <Link to="/activity" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to activity
        </Link>

        {isLoading ? (
          <Centered><Loader2 className="h-4 w-4 animate-spin" /> Loading…</Centered>
        ) : isError || !screen ? (
          <Centered>
            <span className="text-destructive">{(error as Error)?.message || "Not available"}</span>
          </Centered>
        ) : screen.status === "completed" || screen.status === "declined" ? (
          <ClosedCard screen={screen} />
        ) : screen.mode === "live" ? (
          <LiveScreenBody screen={screen} onDecline={() => declineMut.mutate()} declining={declineMut.isPending} />
        ) : screen.mode === "video" ? (
          <VideoScreenBody screen={screen} onDone={invalidate} onDecline={() => declineMut.mutate()} declining={declineMut.isPending} />
        ) : (
          <TextScreenBody
            screen={screen} answers={answers} setAnswers={setAnswers} allAnswered={allAnswered}
            onSubmit={() => submitMut.mutate()} submitting={submitMut.isPending}
            onDecline={() => declineMut.mutate()} declining={declineMut.isPending}
            onPaste={integrity.notePaste}
          />
        )}
      </main>
    </div>
  );
};

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-20">{children}</div>;
}

function ClosedCard({ screen }: { screen: CandidateScreen }) {
  if (screen.status === "declined") {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <h1 className="text-lg font-semibold text-foreground">Screening declined</h1>
        <p className="text-sm text-muted-foreground mt-2">You declined this screening.</p>
        <Button asChild variant="outline" className="mt-5"><Link to="/activity">Back to activity</Link></Button>
      </div>
    );
  }
  return (
    <>
      <SubmittedCard screen={screen} />
      {/* Everyone who finishes gets their coaching feedback, decision or not. */}
      {screen.mode === "live" && <ScreenFeedbackPanel screenId={screen.id} />}
    </>
  );
}

function SubmittedCard({ screen }: { screen: CandidateScreen }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center">
      <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-4">
        <CheckCircle2 className="h-7 w-7" />
      </div>
      <h1 className="text-lg font-semibold text-foreground">
        {screen.mode === "live" ? "Interview submitted" : "Screening submitted"}
      </h1>
      <p className="text-sm text-muted-foreground mt-2">
        Your{" "}
        {screen.mode === "video"
          ? "video answers went"
          : screen.mode === "live"
            ? "interview went"
            : "answers went"}{" "}
        to {screen.company}. They'll be in touch if it's a fit.
        {screen.mode === "live" && " Either way, your feedback from this interview is below."}
      </p>
      <Button asChild variant="outline" className="mt-5"><Link to="/activity">Back to activity</Link></Button>
    </div>
  );
}

/* -------------------------------- live ----------------------------------- */

/**
 * Consent gate for a live AI interview.
 *
 * A live screening is recorded and transcribed, so starting one has to be a
 * deliberate act after reading what happens to the recording — not an implied
 * consequence of opening the link. Declining stays available right here.
 */
function LiveScreenBody({
  screen,
  onDecline,
  declining,
}: {
  screen: CandidateScreen;
  onDecline: () => void;
  declining: boolean;
}) {
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);
  const [accepted, setAccepted] = useState(!!screen.consentAt);

  const start = async () => {
    setStarting(true);
    try {
      if (!accepted) await consentToLiveScreen(screen.id);
      const { sessionId, config } = await startLiveScreen(screen.id);
      await useInterviewSessionStore.getState().begin(
        { ...(config as unknown as InterviewConfig), screenMode: true, screenId: screen.id },
        sessionId,
      );
      navigate(`/interview-prep/session/${sessionId}`);
    } catch (e) {
      toast.error((e as Error).message || "Couldn't start the interview");
      setStarting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <ScreenIntro screen={screen} subtitle={`A short spoken interview for ${screen.company}.`} />

      <div className="mt-5 space-y-3 text-sm text-muted-foreground">
        <p>
          You'll talk with Nova, our AI interviewer, for about{" "}
          {Math.max(10, screen.questions.length * 3)} minutes. There are{" "}
          {screen.questions.length} question{screen.questions.length === 1 ? "" : "s"}, the same ones
          every candidate for this role is asked.
        </p>
        <ul className="space-y-2 rounded-xl border border-border bg-muted/40 p-4">
          <li>• Your answers are recorded and transcribed so they can be reviewed.</li>
          <li>• A summary and score go to {screen.company}. A person there makes the decision — the AI does not.</li>
          <li>• You can decline instead, and it won't count against your application.</li>
          <li>• You get one attempt, so start when you're somewhere quiet.</li>
        </ul>
        <p className="text-xs">
          You'll need a working microphone. If speech isn't available in your browser, you can type
          your answers instead.
        </p>
      </div>

      <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-sm">
        <Checkbox
          checked={accepted}
          onCheckedChange={(v) => setAccepted(v === true)}
          disabled={!!screen.consentAt || starting}
          className="mt-0.5"
          aria-label="Accept the AI interview notice"
        />
        <span className="text-muted-foreground">
          I understand this interview is conducted by AI, and recorded and transcribed for{" "}
          {screen.company} to review.
        </span>
      </label>

      <div className="mt-5 flex items-center gap-2">
        <Button onClick={() => void start()} disabled={!accepted || starting}>
          {starting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />}
          Start interview
        </Button>
        <Button variant="ghost" onClick={onDecline} disabled={declining || starting}>
          Decline
        </Button>
      </div>

      <AccommodationsRequest screenId={screen.id} existing={screen.accommodations} />
    </div>
  );
}

/* -------------------------------- text ----------------------------------- */

function TextScreenBody({
  screen, answers, setAnswers, allAnswered, onSubmit, submitting, onDecline, declining, onPaste,
}: {
  screen: CandidateScreen;
  answers: string[];
  setAnswers: (a: string[]) => void;
  allAnswered: boolean;
  onSubmit: () => void;
  submitting: boolean;
  onDecline: () => void;
  declining: boolean;
  onPaste: (chars: number) => void;
}) {
  return (
    <>
      <ScreenIntro screen={screen} subtitle="A few short questions. Answer honestly and in your own words — there's no time limit." />
      <div className="space-y-5">
        {screen.questions.map((q, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm font-medium text-foreground">
              <span className="text-coral mr-1.5">{i + 1}.</span>{q}
            </p>
            <Textarea
              value={answers[i] ?? ""}
              onChange={(e) => {
                const next = [...answers];
                next[i] = e.target.value;
                setAnswers(next);
              }}
              onPaste={(e) => onPaste(e.clipboardData.getData("text").length)}
              placeholder="Your answer…"
              className="mt-3 min-h-[120px] resize-y"
            />
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <Button variant="ghost" className="text-muted-foreground" onClick={onDecline} disabled={declining || submitting}>
          Decline
        </Button>
        <Button variant="coral" onClick={onSubmit} disabled={!allAnswered || submitting}>
          {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</> : "Submit answers"}
        </Button>
      </div>
      {!allAnswered && <p className="mt-2 text-right text-xs text-muted-foreground">Answer every question to submit.</p>}
      <AccommodationsRequest screenId={screen.id} existing={screen.accommodations} />
    </>
  );
}

/* -------------------------------- video ---------------------------------- */

const MAX_SECS = 120;

function pickMimeType(): string {
  const candidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
  return candidates.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) ?? "";
}

function VideoScreenBody({
  screen, onDone, onDecline, declining,
}: { screen: CandidateScreen; onDone: () => void; onDecline: () => void; declining: boolean }) {
  const total = screen.questions.length;
  const [step, setStep] = useState(0);
  const [uploaded, setUploaded] = useState<boolean[]>(() => screen.videoDone ?? Array(total).fill(false));
  const [camPhase, setCamPhase] = useState<"init" | "ready" | "denied" | "error">("init");
  const [recState, setRecState] = useState<"idle" | "recording" | "preview">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [uploading, setUploading] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const liveRef = useRef<HTMLVideoElement | null>(null);
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const timerRef = useRef<number | null>(null);

  // Acquire the camera once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        setCamPhase("ready");
      } catch (err) {
        if (!cancelled) setCamPhase((err as DOMException)?.name === "NotAllowedError" ? "denied" : "error");
      }
    })();
    return () => {
      cancelled = true;
      if (timerRef.current) window.clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  // Bind the live stream to the <video> while idle/recording.
  useEffect(() => {
    if (camPhase === "ready" && recState !== "preview" && liveRef.current) {
      liveRef.current.srcObject = streamRef.current;
    }
  }, [camPhase, recState, step]);

  const clearPreview = () => {
    if (previewUrlRef.current) { URL.revokeObjectURL(previewUrlRef.current); previewUrlRef.current = null; }
    blobRef.current = null;
  };

  const goToStep = (i: number) => {
    if (recState === "recording") return;
    clearPreview();
    setRecState("idle");
    setElapsed(0);
    setStep(i);
  };

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream) return;
    clearPreview();
    chunksRef.current = [];
    const mimeType = pickMimeType();
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType || "video/webm" });
      blobRef.current = blob;
      previewUrlRef.current = URL.createObjectURL(blob);
      setRecState("preview");
      requestAnimationFrame(() => {
        if (previewRef.current && previewUrlRef.current) previewRef.current.src = previewUrlRef.current;
      });
    };
    recorderRef.current = rec;
    rec.start();
    setRecState("recording");
    setElapsed(0);
    timerRef.current = window.setInterval(() => {
      setElapsed((e) => {
        if (e + 1 >= MAX_SECS) stopRecording();
        return e + 1;
      });
    }, 1000);
  };

  const stopRecording = () => {
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
  };

  const saveAnswer = async () => {
    if (!blobRef.current) return;
    setUploading(true);
    try {
      await uploadScreenVideo(screen.id, step, blobRef.current);
      setUploaded((u) => u.map((v, i) => (i === step ? true : v)));
      toast.success(`Answer ${step + 1} saved`);
      clearPreview();
      setRecState("idle");
      if (step < total - 1) setStep(step + 1);
    } catch (e) {
      toast.error((e as Error).message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const submitMut = useMutation({
    mutationFn: () => submitScreen(screen.id),
    onSuccess: () => { toast.success("Video screening submitted"); onDone(); },
    onError: (e) => toast.error((e as Error).message || "Couldn't submit"),
  });

  const allDone = uploaded.length === total && uploaded.every(Boolean);

  if (camPhase === "denied" || camPhase === "error") {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
          <VideoOff className="h-7 w-7 text-muted-foreground" />
        </div>
        <h1 className="text-lg font-semibold text-foreground">
          {camPhase === "denied" ? "Camera and microphone are blocked" : "Couldn't access your camera"}
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          {camPhase === "denied"
            ? "Allow camera & microphone access in your browser's site settings, then reload."
            : "Make sure no other app is using your camera, then reload."}
        </p>
        <Button variant="outline" className="mt-5" onClick={() => window.location.reload()}>Reload</Button>
      </div>
    );
  }

  return (
    <>
      <ScreenIntro screen={screen} subtitle={`Record a short video answer to each question (up to ${MAX_SECS / 60} min). Re-record as many times as you like before saving.`} />

      {/* Progress dots */}
      <div className="flex items-center gap-1.5 mb-4">
        {screen.questions.map((_, i) => (
          <button
            key={i}
            onClick={() => goToStep(i)}
            aria-label={`Question ${i + 1}`}
            className={`h-2 rounded-full transition-all ${i === step ? "w-6 bg-coral" : uploaded[i] ? "w-2 bg-emerald-500" : "w-2 bg-muted"}`}
          />
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm font-medium text-foreground">
          <span className="text-coral mr-1.5">{step + 1}.</span>{screen.questions[step]}
          {uploaded[step] && <span className="ml-2 inline-flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> recorded</span>}
        </p>

        {/* Camera stage */}
        <div className="mt-4 relative rounded-xl overflow-hidden bg-black aspect-video">
          {camPhase === "init" && (
            <div className="absolute inset-0 flex items-center justify-center text-white/60 text-sm gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Starting camera…
            </div>
          )}
          <video ref={liveRef} autoPlay playsInline muted className={`h-full w-full object-cover scale-x-[-1] ${recState === "preview" ? "hidden" : ""}`} />
          <video ref={previewRef} controls playsInline className={`h-full w-full object-cover ${recState === "preview" ? "" : "hidden"}`} />
          {recState === "recording" && (
            <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" /> {fmtSecs(elapsed)} / {fmtSecs(MAX_SECS)}
            </div>
          )}
        </div>

        {/* Recorder controls */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {recState === "idle" && (
            <Button onClick={startRecording} disabled={camPhase !== "ready"}>
              <Circle className="h-4 w-4 fill-red-500 text-red-500" /> {uploaded[step] ? "Re-record" : "Record answer"}
            </Button>
          )}
          {recState === "recording" && (
            <Button onClick={stopRecording} variant="outline">
              <Square className="h-4 w-4 fill-current" /> Stop
            </Button>
          )}
          {recState === "preview" && (
            <>
              <Button onClick={saveAnswer} disabled={uploading} variant="coral">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Save answer
              </Button>
              <Button onClick={() => { clearPreview(); setRecState("idle"); }} variant="outline" disabled={uploading}>
                <RotateCcw className="h-4 w-4" /> Re-record
              </Button>
            </>
          )}

          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" disabled={step === 0 || recState === "recording"} onClick={() => goToStep(step - 1)}>Prev</Button>
            <Button variant="ghost" size="sm" disabled={step === total - 1 || recState === "recording"} onClick={() => goToStep(step + 1)}>Next</Button>
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <Button variant="ghost" className="text-muted-foreground" onClick={onDecline} disabled={declining || submitMut.isPending}>
          Decline
        </Button>
        <Button variant="coral" onClick={() => submitMut.mutate()} disabled={!allDone || submitMut.isPending}>
          {submitMut.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</> : "Submit video screening"}
        </Button>
      </div>
      {!allDone && (
        <p className="mt-2 text-right text-xs text-muted-foreground">
          Record all {total} answers to submit ({uploaded.filter(Boolean).length}/{total} done).
        </p>
      )}
    </>
  );
}

function ScreenIntro({ screen, subtitle }: { screen: CandidateScreen; subtitle: string }) {
  return (
    <div className="mb-6">
      <div className="inline-flex items-center gap-2 rounded-full bg-coral/10 text-coral px-3 py-1 text-xs font-medium mb-3">
        {screen.mode === "video" ? (
          <Video className="h-3.5 w-3.5" />
        ) : screen.mode === "live" ? (
          <Mic className="h-3.5 w-3.5" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
        {screen.mode === "video"
          ? "Video screening"
          : screen.mode === "live"
            ? "AI interview"
            : "AI screening"}
      </div>
      <h1 className="text-2xl font-bold text-foreground">{screen.role ?? "Screening"} · {screen.company}</h1>
      <p className="text-muted-foreground mt-1">{subtitle}</p>
    </div>
  );
}

function fmtSecs(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default AiScreen;
