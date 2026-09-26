// components/chat/TypingIndicator.tsx
// Animated "…thinking" dots shown while the AI is generating.

export function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground">
      <span className="flex gap-1">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:120ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:240ms]" />
      </span>
      Thinking…
    </div>
  );
}