import { useCallback, useEffect, useRef, useMemo, useState } from "react";
import ChatHeader from "./ChatHeader";
import MessageBubble from "./MessageBubble";
import MessageInput from "./MessageInput";
import AISuggestions from "./AISuggestions";
import SearchMessages from "./SearchMessages";
import { useMessageStore } from "@/stores/messageStore";
import CallSurface from "./CallSurface";
import { useIncomingCall } from "@/hooks/useIncomingCall";
import { startCall, type Call, type CallMode } from "@/lib/api/calls";
import supabase from "@/lib/supabase";
import { toast } from "sonner";


interface ChatWindowProps {
  onBack?: () => void;
}

const TypingIndicator = () => (
  <div className="flex items-center gap-2 px-4 py-2 animate-in fade-in-0 duration-300">
    <div className="bg-secondary rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
    </div>
    <span className="text-[11px] text-muted-foreground">typing...</span>
  </div>
);

const ChatWindow = ({ onBack }: ChatWindowProps) => {
  const { activeConversationId, conversations, messages, typingUsers } = useMessageStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const conversation = conversations.find((c) => c.id === activeConversationId);

  const [meId, setMeId] = useState<string | null>(null);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [callBusy, setCallBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMeId(data.user?.id ?? null));
  }, []);

  // The other side rings over the conversation's existing Realtime channel —
  // already open for messages, so nothing new has to be subscribed or polled.
  useIncomingCall({
    conversationId: activeConversationId,
    meId,
    onIncoming: (call) => setActiveCall((current) => current ?? call),
  });

  const beginCall = useCallback(
    async (mode: CallMode) => {
      if (!activeConversationId || callBusy) return;
      setCallBusy(true);
      try {
        const call = await startCall(activeConversationId, mode);
        setActiveCall(call);
        // Ring the other side on the calls channel — the one
        // useIncomingCall subscribes to. The message channel carries a
        // different, narrower event union.
        const ring = supabase.channel(`conv-${activeConversationId}-calls`);
        ring.subscribe((status) => {
          if (status !== "SUBSCRIBED") return;
          void ring
            .send({ type: "broadcast", event: "call", payload: { call: { id: call.id } } })
            // The record already exists server-side; a failed doorbell only
            // means they see it when they next open the thread.
            .finally(() => { void supabase.removeChannel(ring); });
        });
      } catch (e) {
        toast.error((e as Error).message || "Couldn't start the call");
      } finally {
        setCallBusy(false);
      }
    },
    [activeConversationId, callBusy],
  );
  const chatMessages = useMemo(() => (activeConversationId && messages[activeConversationId]) || [], [activeConversationId, messages]);
  const isTyping = activeConversationId ? typingUsers[activeConversationId] : false;

  // Group messages by date
  const grouped = useMemo(() => {
    const groups: { date: string; messages: typeof chatMessages }[] = [];
    chatMessages.forEach((m) => {
      const last = groups[groups.length - 1];
      if (last && last.date === m.date) {
        last.messages.push(m);
      } else {
        groups.push({ date: m.date, messages: [m] });
      }
    });
    return groups;
  }, [chatMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages.length, isTyping]);

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center space-y-2">
          <p className="text-lg font-medium">Select a conversation</p>
          <p className="text-sm">Choose from the sidebar to start messaging</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <ChatHeader
            conversation={conversation}
            onBack={onBack}
            onStartCall={beginCall}
            callBusy={callBusy}
          />
          <SearchMessages />

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {grouped.map((group) => (
              <div key={group.date}>
                <div className="flex items-center justify-center my-4">
                  <span className="text-[10px] font-medium text-muted-foreground bg-secondary/80 rounded-full px-3 py-0.5">
                    {group.date}
                  </span>
                </div>
                {group.messages.map((m, i) => {
                  const prev = group.messages[i - 1];
                  const isFirstInGroup = !prev || prev.from !== m.from;
                  return (
                    <MessageBubble
                      key={m.id}
                      message={m}
                      showAvatar={isFirstInGroup && m.from === "them"}
                      isFirstInGroup={isFirstInGroup}
                    />
                  );
                })}
              </div>
            ))}

            {isTyping && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>

          <MessageInput />
        </div>

        <AISuggestions />
      </div>

      {/* Ringing, in-call and the "couldn't connect" state all live here. */}
      {activeCall && meId && (
        <CallSurface
          call={activeCall}
          meId={meId}
          peerName={conversation.name}
          onClosed={() => setActiveCall(null)}
        />
      )}
    </div>
  );
};

export default ChatWindow;
