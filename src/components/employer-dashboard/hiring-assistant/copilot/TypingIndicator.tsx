export function TypingIndicator() {
  return (
    <div
      className="animate-copilot-in flex items-center gap-2.5 px-1 py-2"
      role="status"
      aria-label="Assistant is thinking"
    >
      <span className="flex gap-1">
        <span className="h-1 w-1 animate-pulse rounded-full bg-muted-foreground/80 [animation-delay:0ms]" />
        <span className="h-1 w-1 animate-pulse rounded-full bg-muted-foreground/80 [animation-delay:150ms]" />
        <span className="h-1 w-1 animate-pulse rounded-full bg-muted-foreground/80 [animation-delay:300ms]" />
      </span>
      <span className="text-[12px] text-muted-foreground">Thinking</span>
    </div>
  );
}
