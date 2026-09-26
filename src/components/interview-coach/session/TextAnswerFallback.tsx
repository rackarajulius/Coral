import { useEffect, useRef, useState } from "react";
import { SendHorizonal } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Typing mode: used when speech recognition is unavailable, denied, or by choice. */
export default function TextAnswerFallback({
  onSubmit,
  disabled,
}: {
  onSubmit: (text: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!disabled) ref.current?.focus();
  }, [disabled]);

  const submit = () => {
    const text = value.trim();
    if (!text) return;
    onSubmit(text);
    setValue("");
  };

  return (
    <div className="w-full max-w-2xl">
      <div className="rounded-2xl border border-ink/15 bg-surface p-3 focus-within:border-coral/60">
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
          disabled={disabled}
          rows={4}
          placeholder="Type your answer… (Ctrl+Enter to submit)"
          aria-label="Your answer"
          className="w-full resize-none bg-transparent text-sm leading-relaxed text-ink placeholder:text-ink-dim focus:outline-none"
        />
        <div className="flex items-center justify-between pt-2">
          <p className="text-[11px] text-ink-dim">
            {value.trim() ? `${value.trim().split(/\s+/).length} words` : "Aim for 80–220 words"}
          </p>
          <Button
            onClick={submit}
            disabled={disabled || !value.trim()}
            size="sm"
            className="rounded-full bg-coral px-5 text-white hover:bg-coral/90"
          >
            Submit answer
            <SendHorizonal className="ml-2 h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
