import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getPersonFollow, setPersonFollow, type PersonFollowStatus } from "@/lib/api/community";

/**
 * Follow / Following for a person, and their follower count.
 *
 * One cache entry per person, so every Follow button for them — beside their
 * name on each of their posts, and on their hover card — shows the same state
 * and moves together. Optimistic, like the company follow: the count and the
 * button change at once and are put back if the server refuses.
 *
 * `enabled` lets a caller wait (e.g. a card that has not opened) instead of
 * asking for every author on the page up front.
 */
export function usePersonFollow(personId: string, enabled = true) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  // Per viewer as well as per person: "following" is a statement about you.
  const key = ["person-follow", personId, user?.id ?? null];

  const status = useQuery({
    queryKey: key,
    queryFn: () => getPersonFollow(personId),
    enabled: enabled && !!personId,
    staleTime: 60_000,
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: (next: boolean) => setPersonFollow(personId, next),
    onMutate: async (next): Promise<{ previous?: PersonFollowStatus }> => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<PersonFollowStatus>(key);
      const base = previous ?? { isFollowing: !next, followerCount: 0 };
      queryClient.setQueryData<PersonFollowStatus>(key, {
        isFollowing: next,
        followerCount: Math.max(0, base.followerCount + (next ? 1 : -1)),
      });
      return { previous };
    },
    onError: (e, _next, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
      toast.error((e as Error).message);
    },
    onSuccess: (result) => {
      queryClient.setQueryData(key, result);
      // The Following feed is cached for minutes; without this, someone just
      // followed would not appear in it until that ran out.
      void queryClient.invalidateQueries({ queryKey: ["community-posts", "feed", "following"] });
    },
  });

  const isFollowing = status.data?.isFollowing ?? false;

  return {
    isFollowing,
    followerCount: status.data?.followerCount ?? null,
    isLoading: status.isLoading,
    isPending: mutation.isPending,
    toggle: () => mutation.mutate(!isFollowing),
  };
}
