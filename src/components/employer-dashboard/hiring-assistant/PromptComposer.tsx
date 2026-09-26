import { useEffect, useRef, useState } from "react";
import { Paperclip, Mic, ArrowUp, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { IconButton } from "@/components/employer-dashboard/hiring-assistant/Iconbutton";
import { toast } from "sonner";
import { prepareMic } from "@/lib/mic";
import { speechLanguage, speechRecognitionSupported, voiceErrorMessage } from "@/lib/voiceErrors";
import { cn } from "@/lib/utils";

interface PromptComposerProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (value?: string) => void;
  /** "full"  → centred hero composer  |  "docked" → compact side-panel */
  variant?: "full" | "docked";
  placeholder?: string;
  disabled?: boolean;
}

// Extend window for webkit prefix
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

export function PromptComposer({
  value,
  onChange,
  onSubmit,
  variant = "full",
  placeholder,
  disabled = false,
}: PromptComposerProps) {
  const isFull = variant === "full";

  // ── Attachments ────────────────────────────────────────────────────────────
  const fileRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<File[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setAttachments((prev) => [...prev, ...files]);
    e.target.value = "";
  };

  const removeAttachment = (name: string) =>
    setAttachments((prev) => prev.filter((f) => f.name !== name));

  // ── Microphone ─────────────────────────────────────────────────────────────
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  /** Set synchronously on the press, before the permission check is awaited. */
  const startingRef = useRef(false);
  const [isListening, setIsListening] = useState(false);
  const canDictate = speechRecognitionSupported();

  /**
   * Closing the panel while it listens used to leave the microphone open — the
   * browser's recording indicator stayed on until it timed out by itself.
   */
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  const toggleMic = async () => {
    // Guarded by refs, not `isListening`: two quick presses both see the old
    // state, and each would open a microphone stream nothing ever closes.
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }
    if (startingRef.current || !canDictate) return;
    startingRef.current = true;

    try {
      // Frame the browser permission prompt (and handle a blocked mic gracefully).
      if (!(await prepareMic("voice input"))) return;
      startDictation();
    } finally {
      startingRef.current = false;
    }
  };

  const startDictation = () => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    // The person's own language, not a hard-coded en-US.
    rec.lang = speechLanguage();

    let baseValue = value;

    rec.onstart = () => setIsListening(true);

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      if (final) baseValue = (baseValue + " " + final).trimStart();
      onChange(baseValue + (interim ? " " + interim : ""));
    };

    rec.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
      onChange(baseValue.trim());
    };

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      setIsListening(false);
      recognitionRef.current = null;
      // It used to stop with no explanation at all — including when the
      // microphone was blocked, which looks like a broken button.
      const message = voiceErrorMessage(e.error);
      if (message) toast.error(message);
    };

    recognitionRef.current = rec;
    try {
      rec.start();
    } catch {
      recognitionRef.current = null;
      toast.error("Couldn't start voice input. Try again.");
    }
  };

  return (
    <div
      className={cn(
        "rounded-3xl border border-border bg-card/80 shadow-elevated backdrop-blur-xl",
        isFull
          ? "p-2 transition-shadow hover:shadow-2xl"
          : "rounded-2xl bg-background p-1.5 shadow-soft focus-within:border-foreground/20 focus-within:shadow-card"
      )}
    >
      {/* Attachment chips */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-3 pt-2.5 pb-1">
          {attachments.map((file) => (
            <span
              key={file.name}
              className="flex items-center gap-1 rounded-lg border border-border/60 bg-secondary/50 px-2 py-0.5 text-[11px] text-foreground/80"
            >
              <Paperclip className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
              <span className="max-w-[140px] truncate">{file.name}</span>
              <button
                type="button"
                onClick={() => removeAttachment(file.name)}
                className="ml-0.5 text-muted-foreground hover:text-foreground"
                aria-label="Remove attachment"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      <Textarea
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (value.trim()) onSubmit(value.trim());
          }
        }}
        placeholder={
          placeholder ??
          (isFull
            ? "Senior frontend engineer with React, startup experience, and strong system design skills…"
            : "Refine requirements, ask for more candidates…")
        }
        className={cn(
          "resize-none border-0 bg-transparent shadow-none focus-visible:ring-0",
          // text-base on the full variant is deliberate: iOS zooms the page
          // when a focused input is under 16px, which throws the layout.
          isFull
            ? "min-h-[96px] px-4 py-3 text-base sm:min-h-[120px]"
            : "min-h-[60px] px-2.5 py-2 text-sm"
        )}
      />

      <div
        className={cn(
          "flex items-center justify-between",
          isFull ? "px-2 pb-2" : "px-1 pb-1"
        )}
      >
        {/* Left toolbar */}
        <div className="flex items-center gap-0.5">
          {/* Attach */}
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
          <IconButton
            icon={Paperclip}
            label="Attach file"
            onClick={() => fileRef.current?.click()}
          />

          {/* Microphone — hidden where the browser can't do it, rather than a
              button that silently does nothing. */}
          {canDictate && (
            <div className="relative">
              <IconButton
                icon={Mic}
                label={isListening ? "Stop recording" : "Use microphone"}
                onClick={toggleMic}
                className={cn(isListening && "text-red-500 hover:text-red-600")}
              />
              {isListening && (
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-card animate-pulse" />
              )}
            </div>
          )}
        </div>

        {/* Submit */}
        <Button
          size="sm"
          onClick={() => { if (value.trim()) onSubmit(value.trim()); }}
          disabled={disabled || !value.trim()}
          aria-label="Submit prompt"
          className={cn(
            "bg-foreground text-background hover:bg-foreground/90",
            isFull ? "h-9 rounded-xl px-4" : "h-8 rounded-lg px-3"
          )}
        >
          {isFull ? <ArrowUp className="h-4 w-4" /> : <Send className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}
