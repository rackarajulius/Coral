import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { getSavedProfessionalIds, saveProfessional, unsaveProfessional } from "@/lib/api/providers";

/** Everything saved for one person: their ids, and the pages of their list. */
export const savedProfessionalsKey = (userId: string | undefined) => ["saved-professionals", userId] as const;

/**
 * Save or unsave a professional. Every button shares one list of ids, so a page
 * of cards asks once and they all move together. Asks a signed-out visitor to
 * sign in first. `canSave` is false on your own profile.
 */
export function useSavedProfessional(professionalId: string) {
  const { user, isAuthenticated } = useAuth();
  const { requireAuth } = useAuthModal();
  const queryClient = useQueryClient();
  const allKey = savedProfessionalsKey(user?.id);
  const idsKey = [...allKey, "ids"];

  const { data: ids } = useQuery({
    queryKey: idsKey,
    queryFn: ({ signal }) => getSavedProfessionalIds(signal),
    enabled: isAuthenticated,
    staleTime: 60_000,
    retry: false,
  });
  const isSaved = !!ids?.includes(professionalId);

  const mutation = useMutation({
    mutationFn: (save: boolean) => (save ? saveProfessional(professionalId) : unsaveProfessional(professionalId)),
    onMutate: async (save) => {
      await queryClient.cancelQueries({ queryKey: idsKey });
      const previous = queryClient.getQueryData<string[]>(idsKey);
      queryClient.setQueryData<string[]>(idsKey, (old = []) =>
        save ? [...old, professionalId] : old.filter((id) => id !== professionalId),
      );
      return { previous };
    },
    onSuccess: (_result, save) => {
      if (save) return;
      // On the saved page the card leaves at once, so a slip of the hand can be undone.
      toast("Removed from saved", { action: { label: "Undo", onClick: () => mutation.mutate(true) } });
    },
    onError: (error: Error, _save, context) => {
      queryClient.setQueryData(idsKey, context?.previous);
      toast.error(error.message);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: allKey }),
  });

  return {
    isSaved,
    canSave: user?.id !== professionalId,
    isPending: mutation.isPending,
    toggle: () => requireAuth(() => mutation.mutate(!isSaved)),
  };
}
