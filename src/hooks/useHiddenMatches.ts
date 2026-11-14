import { useState } from "react";
import { toast } from "sonner";
import { dismissMatch, undismissMatch, type MatchedJob } from "@/lib/api/resumeMatcher";

/** Matches dismissed on this page; the server leaves them out of later searches. */
export function useHiddenMatches() {
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(new Set());

  const setHidden = (id: string, hidden: boolean) =>
    setHiddenIds((prev) => {
      const next = new Set(prev);
      if (hidden) next.add(id);
      else next.delete(id);
      return next;
    });

  /**
   * Hides the match at once, with an undo. If the server can't record it, the
   * match comes back, since it would otherwise reappear on the next search.
   */
  const notInterested = (m: MatchedJob) => {
    setHidden(m.id, true);
    dismissMatch({ jobId: m.id, title: m.title, company: m.company }).then(
      () =>
        toast(`Hidden: ${m.title}`, {
          description: "You won't be shown this job again.",
          action: {
            label: "Undo",
            onClick: () => {
              setHidden(m.id, false);
              undismissMatch(m.id).catch((e: Error) => {
                setHidden(m.id, true);
                toast.error(e.message);
              });
            },
          },
        }),
      (e: Error) => {
        setHidden(m.id, false);
        toast.error(e.message);
      },
    );
  };

  return { hiddenIds, notInterested };
}
