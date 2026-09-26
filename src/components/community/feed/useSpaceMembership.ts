import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { joinSpace, leaveSpace, type Space } from "@/lib/api/community";

/**
 * Join or leave, from anywhere a space is listed.
 *
 * Refreshes every list a membership appears in: the sidebar's "your spaces",
 * the directory, the space's own page, and the "My spaces" feed — which is a
 * different set of posts the moment this changes.
 */
export function useSpaceMembership(space: Pick<Space, "id" | "slug" | "joined">) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (join: boolean) => (join ? joinSpace(space.id) : leaveSpace(space.id)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["community-spaces"] });
      void queryClient.invalidateQueries({ queryKey: ["space", space.slug] });
      void queryClient.invalidateQueries({ queryKey: ["community-posts"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });
}
