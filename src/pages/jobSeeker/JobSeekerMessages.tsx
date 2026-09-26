import { useState } from "react";
import Header from "@/components/Header";
import ConversationList from "@/components/employer-dashboard/messaging/ConversationList";
import ChatWindow from "@/components/employer-dashboard/messaging/ChatWindow";
import { useMessagingRealtime } from "@/hooks/useMessagingRealtime";
import { useConversationDeepLink } from "@/hooks/useConversationDeepLink";

/**
 * Job-seeker inbox — reuses the messaging components (they resolve the peer from
 * the API, so a candidate sees the employer/company side). Completes the two-way
 * reply loop from messaging Phase 1.
 */
export default function JobSeekerMessages() {
  const [showChat, setShowChat] = useState(false);
  useMessagingRealtime();
  // ?c=<id> opens that thread — how a notification lands in the right one.
  useConversationDeepLink(() => setShowChat(true));

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <div className="flex-1 min-h-0 pt-16">
        <div className="flex h-[calc(100vh-4rem)] min-h-0 overflow-hidden">
          <div
            className={`
              h-full min-h-0 w-full shrink-0 border-r border-border
              md:w-80 lg:w-96
              ${showChat ? "hidden md:flex md:flex-col" : "flex flex-col"}
            `}
          >
            <ConversationList onSelect={() => setShowChat(true)} />
          </div>

          <div
            className={`
              h-full min-h-0 min-w-0 flex-1
              ${showChat ? "flex flex-col" : "hidden md:flex md:flex-col"}
            `}
          >
            <ChatWindow onBack={() => setShowChat(false)} />
          </div>
        </div>
      </div>
    </div>
  );
}
