import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  findShortlistForQuery,
  getShortlist,
  openShortlist,
  upsertShortlistItem,
  type Shortlist,
  type ShortlistItem,
  type ShortlistStage,
} from "@/lib/api/shortlist";
import type { Candidate } from "@/data/employer/HiringAssistant/Index";

interface Change {
  candidateId: string;
  stage?: ShortlistStage | null;
  saved?: boolean;
  snapshot?: Candidate;
}

/**
 * The project the workspace is working in: its saved candidates and pipeline,
 * stored server-side so the workspace survives a refresh. Mutations apply
 * optimistically and reconcile on settle.
 *
 * Two things it deliberately does not do:
 *
 * **It does not create a project just because someone searched.** Opening a
 * search used to create a container there and then, which is why this database
 * filled with empty ones — "frontend dev", "frontend developer", "frontend
 * developer with 2 years of experience in", none of them holding anybody. A
 * project now comes into existence when there is a person to put in it, on the
 * first add.
 *
 * **It is not bound to the search.** Pass `projectId` and the workspace works in
 * that project instead, so a recruiter running a third search for the same job
 * can feed the project they already have rather than starting a fourth.
 */
export function useShortlist(query?: string, roleTitle?: string, projectId?: string) {
  const qc = useQueryClient();
  // Keyed by whichever thing identifies the project being worked in, so
  // switching projects swaps the cache entry rather than mixing two pipelines.
  const key = projectId
    ? (["hiring", "shortlist", "id", projectId] as const)
    : (["hiring", "shortlist", "query", query ?? ""] as const);

  const { data: shortlist, isLoading } = useQuery({
    queryKey: key,
    // Reading, not opening: nothing is created by looking.
    queryFn: () => (projectId ? getShortlist(projectId) : findShortlistForQuery(query!)),
    enabled: !!projectId || (!!query && query.trim().length > 0),
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: async (c: Change) => {
      /**
       * The first add is what creates the project.
       *
       * Named from the role the AI parsed out of the prompt where there is one,
       * which reads better in the rail than the raw words someone typed.
       */
      const target = shortlist ?? (query ? await openShortlist(query, roleTitle) : null);
      if (!target) throw new Error("There is no project to add to yet.");
      return upsertShortlistItem(target.id, c.candidateId, c);
    },
    onMutate: async (c: Change) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Shortlist>(key);
      // Nothing cached yet means the project does not exist yet either. The
      // refetch below brings back the real one rather than inventing a shape.
      if (prev) {
        const items = [...prev.items];
        const i = items.findIndex((x) => x.candidateId === c.candidateId);
        const base: ShortlistItem =
          i >= 0
            ? items[i]
            : {
                candidateId: c.candidateId,
                stage: null,
                saved: false,
                snapshot: c.snapshot as Candidate,
                addedAt: new Date().toISOString(),
                // Optimistically unlinked. The server decides whether this
                // person already has an application here, and the refetch
                // brings back the real answer — guessing "linked" would show a
                // cross-link to an application that may not exist.
                applicationId: null,
                // The server assigns the real one; the refetch brings it
                // back. Nothing can be moved between projects until then,
                // which is a moment, not a state worth designing for.
                id: "",
              };
        const next: ShortlistItem = {
          ...base,
          stage: c.stage === undefined ? base.stage : c.stage,
          saved: c.saved === undefined ? base.saved : c.saved,
          snapshot: c.snapshot ?? base.snapshot,
        };
        // Neither saved nor staged → the server drops it; mirror that here.
        const survives = next.saved || next.stage !== null;
        if (i >= 0) {
          if (survives) items[i] = next;
          else items.splice(i, 1);
        } else if (survives) {
          items.push(next);
        }
        qc.setQueryData<Shortlist>(key, { ...prev, items });
      }
      return { prev };
    },
    onError: (e, _c, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
      // The card flips back either way; without this it did so in silence, which
      // reads as a glitch — and for a read-only seat, as a bug.
      toast.error((e as Error).message || "Couldn't update the project");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: key });
      // A project that has just been created belongs in the rail.
      void qc.invalidateQueries({ queryKey: ["hiring-shortlists"] });
    },
  });

  /**
   * No `shortlist` guard any more: not having one is the normal state before
   * the first add, and refusing there is what made "Add to pipeline" silently
   * do nothing on a fresh search.
   */
  const apply = useCallback((c: Change) => mutation.mutate(c), [mutation]);

  return {
    shortlist,
    items: shortlist?.items ?? [],
    isLoading,
    /** There is a project to read from. Adding does not require one. */
    ready: !!shortlist,
    apply,
  };
}
