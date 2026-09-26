import { ChevronDown, Mic, Paperclip, Plus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const MODELS = ["Hiring Graph v2", "Fast refine", "Deep analysis"] as const;

interface ContextToolbarProps {
  disabled?: boolean;
  quickActions?: string[];
  onQuickAction?: (action: string) => void;
  model: string;
  onModelChange: (model: string) => void;
  className?: string;
}

export function ContextToolbar({
  disabled,
  quickActions = [],
  onQuickAction,
  model,
  onModelChange,
  className,
}: ContextToolbarProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            disabled={disabled}
            title="Attach"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:opacity-40"
          >
            <Plus  className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={disabled}
            title="Voice"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:opacity-40"
          >
            <Mic className="h-3.5 w-3.5" />
          </button>
        </div>

      </div>
    </div>
  );
}
