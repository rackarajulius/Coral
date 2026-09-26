import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Job } from "@/data/jobs";
import type { SavedJob } from "@/data/jobactivity/job-activity-mock";
import { getMySavedJobs, saveJob, unsaveJob } from "@/lib/api/savedJobs";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";

const SAVED_KEY = ["my-saved-jobs"] as const;

/**
 * Real save/unsave for a job, backed by /saved-jobs and shared (same query key)
 * with the /activity Saved tab. Prompts sign-in when the user isn't authed.
 */
export function useSavedJob(job: Job) {
  const { isAuthenticated } = useAuth();
  const { requireAuth } = useAuthModal();
  const queryClient = useQueryClient();

  const { data: savedJobs } = useQuery({
    queryKey: SAVED_KEY,
    queryFn: getMySavedJobs,
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  const isSaved = !!savedJobs?.some((s) => s.id === job.id);

  const mutation = useMutation({
    mutationFn: () => (isSaved ? unsaveJob(job.id) : saveJob(job.id)),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: SAVED_KEY });
      const prev = queryClient.getQueryData<SavedJob[]>(SAVED_KEY);
      queryClient.setQueryData<SavedJob[]>(SAVED_KEY, (old = []) =>
        isSaved
          ? old.filter((s) => s.id !== job.id)
          : [
              {
                id: job.id,
                title: job.title,
                company: job.company,
                location: job.location,
                salary: job.salary,
                type: job.type as SavedJob["type"],
                posted: job.postedAt,
                description: job.description,
                responsibilities: job.responsibilities,
                benefits: job.benefits,
                skills: job.tags,
              },
              ...old,
            ],
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(SAVED_KEY, ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: SAVED_KEY }),
  });

  /** Save/unsave, prompting sign-in first when required. */
  const toggle = () => requireAuth(() => mutation.mutate());

  return { isSaved, toggle, isPending: mutation.isPending };
}
