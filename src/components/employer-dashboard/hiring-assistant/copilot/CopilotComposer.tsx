import { useState } from "react";
import { ArrowUp } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ContextToolbar } from "./ContextToolbar";
import { aiActions } from "@/data/employer/HiringAssistant/constants";

interface CopilotComposerProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export function CopilotComposer({ value, onChange, onSubmit, disabled }: CopilotComposerProps) {
  const [model, setModel] = useState("Hiring Graph v2");

  return (
    <div className="shrink-0 bg-background/95 p-3 backdrop-blur-md">
      <div
        className={cn(
          "flex flex-col gap-0 rounded-2xl border border-border/50 bg-muted/15 shadow-sm",
          "ring-1 ring-border/20 transition-shadow focus-within:border-foreground/10 focus-within:ring-foreground/10",
          disabled && "opacity-60"
        )}
      >
        {/* Input area */}
        <Textarea
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (disabled) return;
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (value.trim()) onSubmit();
            }
          }}
          placeholder="Refine requirements, ask for analysis, or issue a command…"
          rows={3}
          className="min-h-[72px] resize-none border-0 bg-transparent px-3 pt-3 pb-1 text-[13px] leading-relaxed shadow-none focus-visible:ring-0"
        />

        {/* Toolbar + send button row */}
        <div className="flex items-center justify-between px-2 pb-2">
          <ContextToolbar
            disabled={disabled}
            model={model}
            onModelChange={setModel}
            quickActions={aiActions}
            onQuickAction={(action) => onChange(action)}
          />

          <button
            type="button"
            onClick={onSubmit}
            disabled={disabled || !value.trim()}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-foreground text-background
                       transition-all hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Send message"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}