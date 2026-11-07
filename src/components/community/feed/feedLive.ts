import supabase from "@/lib/supabase";

/**
 * "Someone posted" — a nudge between open community pages, carrying nothing.
 *
 * The same pattern as the candidate boards (useBoardSync): a broadcast with no
 * data, sent by whoever posted once the server has the post. A listener learns
 * only that something was posted somewhere, then asks the server how many new
 * posts its own feed has (which applies the feed's rules); so even someone with
 * no business on the channel learns nothing, and a forged nudge costs one
 * count.
 *
 * Posts published server-side — a scheduled post going out — send no nudge.
 * The "New posts" check also runs every minute, which catches those.
 */

const CHANNEL = "community-feed";
const EVENT = "posted";

type Listener = () => void;
const listeners = new Set<Listener>();
let channel: ReturnType<typeof supabase.channel> | null = null;

function ensureChannel() {
  if (channel) return channel;
  // Our own nudge would otherwise come back to us; our own post is already
  // at the top of our feed.
  channel = supabase.channel(CHANNEL, { config: { broadcast: { self: false } } });
  channel.on("broadcast", { event: EVENT }, () => listeners.forEach((listener) => listener())).subscribe();
  return channel;
}

/** Calls `listener` whenever someone else posts. Returns the way to stop. */
export function onNewPost(listener: Listener): () => void {
  ensureChannel();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Tells everyone else's open feed that a post went out. Never throws and is
 * never awaited: the post is already saved, and a lost nudge only means the
 * others find out at their next minute's check.
 */
export function announceNewPost(): void {
  try {
    void ensureChannel().send({ type: "broadcast", event: EVENT, payload: {} }).catch(() => undefined);
  } catch {
    // Realtime unavailable: the minute's check still finds it.
  }
}
