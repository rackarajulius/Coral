import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { FollowStatus, getFollowStatus, setFollowCompany } from "@/lib/api/employerCompany";

interface UseFollowCompanyArgs {
  companyId?: string;
  /** Follower count from the loaded company record — seeds the UI before the status fetch resolves. */
  initialFollowerCount?: number;
}

/**
 * Drives a company "Follow" button: reads the current user's follow state and
 * exposes an optimistic toggle. Status is only fetched when authenticated; for
 * signed-out visitors the button should route to login instead of calling toggle.
 */
export function useFollowCompany({ companyId, initialFollowerCount = 0 }: UseFollowCompanyArgs) {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const key = ["follow-status", companyId];

  const { data } = useQuery({
    queryKey: key,
    queryFn: () => getFollowStatus(companyId!),
    enabled: !!companyId && isAuthenticated,
    staleTime: 60 * 1000,
  });

  const mutation = useMutation({
    mutationFn: (next: boolean) => setFollowCompany(companyId!, next),
    onMutate: async (next): Promise<{ previous?: FollowStatus }> => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<FollowStatus>(key);
      const base = previous ?? { isFollowing: !next, followerCount: initialFollowerCount };
      queryClient.setQueryData<FollowStatus>(key, {
        isFollowing: next,
        followerCount: Math.max(0, base.followerCount + (next ? 1 : -1)),
      });
      return { previous };
    },
    onError: (_err, _next, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
    },
    onSuccess: (result) => {
      queryClient.setQueryData(key, result);
      // A followed company's posts belong in the community's Following feed,
      // which is cached for minutes.
      void queryClient.invalidateQueries({ queryKey: ["community-posts", "feed", "following"] });
    },
  });

  const isFollowing = data?.isFollowing ?? false;
  const followerCount = data?.followerCount ?? initialFollowerCount;

  return {
    isAuthenticated,
    isFollowing,
    followerCount,
    isPending: mutation.isPending,
    toggle: () => mutation.mutate(!isFollowing),
  };
}
