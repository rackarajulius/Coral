import { useEffect, type RefObject } from "react";
import { recordPostViews } from "@/lib/api/community";

/** On screen this long, at least half showing, before it counts as seen. */
const DWELL_MS = 1000;
/** Views wait this long to go out together, rather than one request per card. */
const FLUSH_MS = 4000;
const BATCH = 20;

const pending = new Set<string>();
// Per account: someone who signs out and another who signs in, in the same
// tab, are different readers.
const sent = new Set<string>();
let timer: number | null = null;

function flush() {
  if (timer !== null) {
    window.clearTimeout(timer);
    timer = null;
  }
  if (pending.size === 0) return;
  const keys = [...pending];
  pending.clear();
  keys.forEach((key) => sent.add(key));
  const ids = keys.map((key) => key.slice(key.indexOf(":") + 1));
  // Not retried: a view that fails to send is a view not counted, which is
  // the safe direction to be wrong in.
  void recordPostViews(ids).catch(() => undefined);
}

function queue(viewerId: string, postId: string) {
  const key = `${viewerId}:${postId}`;
  if (sent.has(key) || pending.has(key)) return;
  pending.add(key);
  if (pending.size >= BATCH) flush();
  else if (timer === null) timer = window.setTimeout(flush, FLUSH_MS);
}

if (typeof document !== "undefined") {
  // Leaving the page sends what is waiting rather than dropping it.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}

/**
 * Counts a post as seen once it has been at least half on screen — or filled
 * half the screen, for a post taller than that — for a second. The server
 * decides what counts: once per person per day, never the author or their
 * company's team. Only for signed-in readers; `viewerId` null turns it off.
 */
export function usePostView(ref: RefObject<HTMLElement>, postId: string, viewerId: string | null | undefined) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !viewerId) return;
    let dwell: number | null = null;
    const stop = () => {
      if (dwell !== null) window.clearTimeout(dwell);
      dwell = null;
    };
    const watch = new IntersectionObserver(
      ([entry]) => {
        const enough = Math.min(entry.boundingClientRect.height, window.innerHeight) * 0.5;
        if (entry.isIntersecting && entry.intersectionRect.height >= enough) {
          if (dwell === null) dwell = window.setTimeout(() => queue(viewerId, postId), DWELL_MS);
        } else {
          stop();
        }
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    watch.observe(el);
    return () => {
      watch.disconnect();
      stop();
    };
  }, [ref, postId, viewerId]);
}
