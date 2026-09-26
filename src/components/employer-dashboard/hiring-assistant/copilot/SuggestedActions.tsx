import { cn } from "@/lib/utils";

interface SuggestedActionsProps {
  actions: string[];
  onSelect: (action: string) => void;
  className?: string;
}

export function SuggestedActions({ actions, onSelect, className }: SuggestedActionsProps) {
  return (
    <div className={cn("animate-copilot-in space-y-2 pt-1", className)}>
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
        Suggested
      </p>
      <div className="flex flex-wrap gap-1.5">
        {actions.map((action) => (
          <button
            key={action}
            type="button"
            onClick={() => onSelect(action)}
            aria-label={`Use suggestion: ${action}`}
            className="rounded-full border border-border/50 bg-background/60 px-2.5 py-1 text-[11px] text-muted-foreground
                       transition-all hover:border-foreground/15 hover:bg-muted/50 hover:text-foreground"
          >
            {action}
          </button>
        ))}
      </div>
    </div>
  );
}
