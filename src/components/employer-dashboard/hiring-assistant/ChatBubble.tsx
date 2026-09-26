// components/chat/ChatBubble.tsx
// A single message bubble inside the AI side-panel conversation thread.

import { Bot, User as UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Message } from "@/data/employer/HiringAssistant/Index";

export function ChatBubble({ role, text }: Message) {
  const isUser = role === "user";

  return (
    <div className={cn("flex gap-2", isUser && "flex-row-reverse")}>
      {/* Avatar */}
      <div
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
          isUser
            ? "bg-secondary text-foreground"
            : "bg-gradient-to-br from-accent to-accent/60 text-accent-foreground"
        )}
      >
        {isUser ? (
          <UserIcon className="h-3 w-3" />
        ) : (
          <Bot className="h-3 w-3" />
        )}
      </div>

      {/* Bubble */}
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed",
          isUser
            ? "bg-foreground text-background"
            : "border border-border bg-background text-foreground"
        )}
      >
        {text}
      </div>
    </div>
  );
}