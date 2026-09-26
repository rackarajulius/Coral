import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useMessageStore } from "@/stores/messageStore";

/**
 * Opens the thread named in `?c=<conversationId>`.
 *
 * The messages pages chose a thread only by clicking one, so any link into a
 * specific conversation — a notification saying "Ada is interested", above all —
 * landed on the inbox and left the reader to find it. This reads the id once,
 * selects it, and drops it from the URL so a refresh or a back-navigation does
 * not keep yanking the reader back to it.
 *
 * `onOpen` lets the page switch to the chat pane on small screens, where the
 * list and the conversation are shown one at a time.
 */
export function useConversationDeepLink(onOpen?: () => void) {
  const [params, setParams] = useSearchParams();
  const setActiveConversation = useMessageStore((s) => s.setActiveConversation);
  const wanted = params.get("c");

  useEffect(() => {
    if (!wanted) return;
    setActiveConversation(wanted);
    onOpen?.();
    const next = new URLSearchParams(params);
    next.delete("c");
    setParams(next, { replace: true });
    // `params` and `onOpen` change identity every render; the id is what
    // decides whether there is anything to do.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted]);
}

export default useConversationDeepLink;
