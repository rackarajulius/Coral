import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listShortlists, moveItemToProject, projectLabel } from "@/lib/api/shortlist";

/**
 * The company's projects, for moving a candidate into the right one.
 *
 * A project used to be whatever search produced it, so "frontend dev",
 * "frontend developer" and "frontend developer with 2 years of experience"
 * were three containers for one hiring effort and the people in them were
 * scattered across all three. This is how they get gathered.
 */
export function useProjects(currentId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["hiring-shortlists"],
    queryFn: listShortlists,
    retry: false,
    staleTime: 60_000,
  });

  const move = useMutation({
    mutationFn: ({ itemId, projectId }: { itemId: string; projectId: string }) =>
      moveItemToProject(itemId, projectId),
    onSuccess: (_data, { projectId }) => {
      // Both ends changed: the one they left and the one they joined.
      void queryClient.invalidateQueries({ queryKey: ["hiring-shortlists"] });
      void queryClient.invalidateQueries({ queryKey: ["shortlist"] });
      const to = query.data?.find((p) => p.id === projectId);
      toast.success(to ? `Moved to ${projectLabel(to)}` : "Moved");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  /**
   * Everywhere except where they already are.
   *
   * "Move to where you already are" is not a choice, it is a no-op dressed as
   * one, and offering it makes the menu longer for no one.
   */
  const others = (query.data ?? [])
    .filter((p) => p.id !== currentId)
    .map((p) => ({ id: p.id, label: projectLabel(p) }));

  const moveItem = useCallback(
    (itemId: string, projectId: string) => move.mutate({ itemId, projectId }),
    [move],
  );

  return { ...query, others, move: moveItem, isMoving: move.isPending };
}
