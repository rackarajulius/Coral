import { useState } from "react";
import ConversationList from "@/components/employer-dashboard/messaging/ConversationList";
import ChatWindow from "@/components/employer-dashboard/messaging/ChatWindow";
import { useMessagingRealtime } from "@/hooks/useMessagingRealtime";
import { useConversationDeepLink } from "@/hooks/useConversationDeepLink";

export default function EmployerMessages() {
  const [showChat, setShowChat] = useState(false);
  useMessagingRealtime();
  // ?c=<id> opens that thread — how a notification lands in the right one.
  useConversationDeepLink(() => setShowChat(true));

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* Conversation list — hidden on mobile when chat is open */}
      <div
        className={`
          h-full min-h-0 w-full shrink-0 border-r border-border
          md:w-80 lg:w-96
          ${showChat ? "hidden md:flex md:flex-col" : "flex flex-col"}
        `}
      >
        <ConversationList onSelect={() => setShowChat(true)} />
      </div>

      {/* Chat window — hidden on mobile when list is shown */}
      <div
        className={`
          h-full min-h-0 min-w-0 flex-1
          ${showChat ? "flex flex-col" : "hidden md:flex md:flex-col"}
        `}
      >
        <ChatWindow onBack={() => setShowChat(false)} />
      </div>
    </div>
  );
}
