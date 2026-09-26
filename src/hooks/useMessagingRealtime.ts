import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import supabase from "@/lib/supabase";
import { useMessageStore } from "@/stores/messageStore";

/**
 * Loads the conversation list and, for the active conversation, subscribes to a
 * Supabase Realtime channel: new-message pings (both sides refetch), typing, and
 * presence (online dot). Role-agnostic — used by both the employer and job-seeker
 * message pages.
 */
export function useMessagingRealtime() {
  const { activeConversationId, loadConversations, handleIncoming, setTyping, setOnline, setBroadcast } =
    useMessageStore();
  const typingTimer = useRef<number | null>(null);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    const id = activeConversationId;
    if (!id) return;
    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      const myId = user?.id ?? Math.random().toString(36).slice(2);

      channel = supabase.channel(`conv-${id}`, {
        config: { broadcast: { self: false }, presence: { key: myId } },
      });

      channel
        .on("broadcast", { event: "msg" }, () => handleIncoming(id))
        .on("broadcast", { event: "typing" }, ({ payload }) => {
          setTyping(id, !!(payload as { typing?: boolean })?.typing);
          if (typingTimer.current) window.clearTimeout(typingTimer.current);
          typingTimer.current = window.setTimeout(() => setTyping(id, false), 3000);
        })
        .on("presence", { event: "sync" }, () => {
          const state = channel!.presenceState();
          const others = Object.keys(state).filter((k) => k !== myId);
          setOnline(id, others.length > 0);
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED" && channel) {
            setBroadcast((event, payload) => channel!.send({ type: "broadcast", event, payload: payload ?? {} }));
            await channel.track({ at: Date.now() });
          }
        });
    })();

    return () => {
      cancelled = true;
      setBroadcast(null);
      setOnline(id, false);
      if (typingTimer.current) window.clearTimeout(typingTimer.current);
      if (channel) supabase.removeChannel(channel);
    };
  }, [activeConversationId, handleIncoming, setTyping, setOnline, setBroadcast]);
}
