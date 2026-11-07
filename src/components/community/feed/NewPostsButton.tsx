import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { ArrowUp } from "lucide-react";
import { getNewPostsCount, type FeedFilter, type FeedSection } from "@/lib/api/community";
import { onNewPost } from "./feedLive";

/** Asked at least this often while the tab is in view, for posts no nudge announced. */
const CHECK_EVERY_MS = 60_000;
/** Never more often than this: a burst of nudges is one question. */
const MIN_GAP_MS = 10_000;

/**
 * "3 new posts" — LinkedIn's and Threads' button at the top of the feed.
 *
 * The feed never moves under the reader by itself. When someone else posts,
 * their page sends a data-free nudge (feedLive); this then asks the server how
 * many posts this feed has gained since its newest one, and offers them. A
 * check also runs every minute while the tab is in view, and on coming back
 * to it, for posts no nudge announced. Tapping it goes to the top and loads
 * the first page again.
 */
export function NewPostsButton({
  feedKey,
  params,
  newestAt,
}: {
  /** The feed's cache key, which gets reloaded from its first page. */
  feedKey: readonly unknown[];
  params: { filter?: FeedFilter; section?: FeedSection };
  /** When the newest post on screen was written; nothing to compare without one. */
  newestAt: string | undefined;
}) {
  const queryClient = useQueryClient();
  const [count, setCount] = useState(0);
  const lastCheck = useRef(0);
  const later = useRef<ReturnType<typeof setTimeout>>();
  const { filter, section } = params;

  // A feed that has just been loaded has nothing new in it yet.
  useEffect(() => setCount(0), [newestAt]);

  const check = useCallback(async () => {
    if (!newestAt) return;
    const wait = lastCheck.current + MIN_GAP_MS - Date.now();
    if (wait > 0) {
      // Too soon: asked once the gap is up, rather than dropped.
      if (!later.current) later.current = setTimeout(() => { later.current = undefined; void check(); }, wait);
      return;
    }
    lastCheck.current = Date.now();
    try {
      setCount(await getNewPostsCount({ filter, section }, newestAt));
    } catch {
      // A missed check is asked again next time.
    }
  }, [newestAt, filter, section]);

  useEffect(() => {
    if (!newestAt) return;
    let jitter: ReturnType<typeof setTimeout> | undefined;
    // A short random wait, so a post doesn't send every open feed to the
    // server in the same instant.
    const stop = onNewPost(() => {
      clearTimeout(jitter);
      jitter = setTimeout(() => void check(), 500 + Math.random() * 2000);
    });
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void check();
    }, CHECK_EVERY_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stop();
      clearTimeout(jitter);
      clearTimeout(later.current);
      later.current = undefined;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [newestAt, check]);

  if (count <= 0) return null;

  const show = async () => {
    setCount(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
    // Back to the first page only, then that page again: the posts on screen
    // stay put while it loads, and nothing else is fetched twice.
    queryClient.setQueryData<InfiniteData<unknown>>(feedKey, (data) =>
      data ? { pages: data.pages.slice(0, 1), pageParams: data.pageParams.slice(0, 1) } : data,
    );
    await queryClient.refetchQueries({ queryKey: feedKey, exact: true });
  };

  return (
    // Floats just under the sticky search row, over the posts, taking no room.
    // items-start, so the button keeps its own height inside a row of none.
    <div className="pointer-events-none sticky top-[9.5rem] z-10 flex h-0 items-start justify-center">
      <button
        type="button"
        onClick={() => void show()}
        className="pointer-events-auto mt-1 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground shadow-lg transition-colors hover:bg-primary/90"
      >
        <ArrowUp className="h-4 w-4" aria-hidden="true" />
        {count === 1 ? "1 new post" : `${count > 99 ? "99+" : count} new posts`}
      </button>
    </div>
  );
}

export default NewPostsButton;
