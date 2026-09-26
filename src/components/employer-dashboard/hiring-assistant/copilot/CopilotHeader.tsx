import { MoreHorizontal, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface CopilotHeaderProps {
  dockedPrompt: string;
  isCopilotTyping: boolean;
  embedded?: boolean;
  className?: string;
}

export function CopilotHeader({
  dockedPrompt,
  isCopilotTyping,
  embedded,
  className,
}: CopilotHeaderProps) {
  return (
    <header
     
    >
      <div className="flex items-center gap-2.5 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-[13px] font-semibold tracking-tight text-foreground">
              Hiring Assistant
            </h2>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                isCopilotTyping
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              )}
            >
              <span
                className={cn(
                  "h-1 w-1 rounded-full",
                  isCopilotTyping ? "animate-pulse bg-amber-500" : "bg-emerald-500"
                )}
              />
              {isCopilotTyping ? "Working" : "Online"}
            </span>
          </div>
        </div>
      </div>

      <div className="border-t border-border/30 px-4 py-2.5">
        <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
          Active context
        </p>
        <p
          className="line-clamp-2 text-[12px] leading-snug text-foreground/90"
          title={dockedPrompt}
        >
          {dockedPrompt}
        </p>
      </div>
    </header>
  );
}
