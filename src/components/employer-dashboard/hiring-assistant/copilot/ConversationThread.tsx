import { useEffect, useRef } from "react";
import type { Message } from "@/data/employer/HiringAssistant/Index";
import { MessageCard } from "./MessageCard";
import { TypingIndicator } from "./TypingIndicator";
import { SuggestedActions } from "./SuggestedActions";

interface ConversationThreadProps {
  messages: Message[];
  isCopilotTyping: boolean;
  showSuggestedActions: boolean;
  suggestedActions: string[];
  onSelectAction: (action: string) => void;
}

export function ConversationThread({
  messages,
  isCopilotTyping,
  showSuggestedActions,
  suggestedActions,
  onSelectAction,
}: ConversationThreadProps) {
  const threadRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isCopilotTyping, showSuggestedActions]);

  return (
    <div
      ref={threadRef}
      id="chat-thread"
      className="chat-thread copilot-thread scrollbar-hide min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
      role="log"
      aria-live="polite"
      aria-relevant="additions"
      aria-label="Copilot conversation"
    >
      <div className="mx-auto max-w-none space-y-6 px-4 py-5">
        {messages.map((message, index) => (
          <MessageCard key={message.id} message={message} index={index} />
        ))}

        {isCopilotTyping && <TypingIndicator />}

        {showSuggestedActions && (
          <SuggestedActions actions={suggestedActions} onSelect={onSelectAction} />
        )}

        <div ref={bottomRef} className="h-1 shrink-0" aria-hidden />
      </div>
    </div>
  );
}
