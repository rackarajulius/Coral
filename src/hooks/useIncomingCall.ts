import { useEffect } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import supabase from "@/lib/supabase";
import { getCall, type Call } from "@/lib/api/calls";

/**
 * Rings when the other side starts a call.
 *
 * Listens on the conversation's own broadcast channel — the same one messages
 * and typing already use — so there is nothing extra to subscribe to and no
 * polling. The payload is only a doorbell: the call is re-fetched from the
 * server, because a broadcast is unauthenticated and its contents must not be
 * trusted to decide what someone is shown.
 */
export function useIncomingCall({
  conversationId,
  meId,
  onIncoming,
}: {
  conversationId: string | null;
  meId: string | null;
  onIncoming: (call: Call) => void;
}) {
  useEffect(() => {
    if (!conversationId || !meId) return;

    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    channel = supabase.channel(`conv-${conversationId}-calls`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "call" }, async ({ payload }) => {
        const id = (payload as { call?: { id?: string } })?.call?.id;
        if (!id || cancelled) return;
        try {
          const call = await getCall(id);
          // Only the person being called should see a ringing screen; the
          // caller already has their own.
          if (!cancelled && call.calleeId === meId && call.state === "RINGING") {
            onIncoming(call);
          }
        } catch {
          // A call that can't be fetched is one this user may not join.
        }
      })
      .subscribe();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [conversationId, meId, onIncoming]);
}
