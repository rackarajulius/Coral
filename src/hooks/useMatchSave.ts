import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import type { MatchedJob } from "@/lib/api/resumeMatcher";
import { getMySavedJobs, saveJob, unsaveJob } from "@/lib/api/savedJobs";
import {
  createExternalApplication,
  deleteExternalApplication,
  getExternalApplications,
} from "@/lib/api/externalApplications";

/** Shared with the job board's save button and the /activity Saved tab. */
const SAVED_KEY = ["my-saved-jobs"] as const;
/** Shared with the External tracker and "Open & track". */
const EXTERNAL_KEY = ["external-applications"] as const;

const PLATFORM_PREFIX = "platform:";

/** As the server stores it (`new URL(…).toString()`), or undefined when not a web address. */
function normalizedUrl(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  try {
    const parsed = new URL(raw.trim());
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Save a match for later, without opening it.
 *
 * A job posted here goes to the saved-jobs list, like the save button on the
 * job board. A job from elsewhere goes to the External tracker as "saved",
 * the same entry "Open & track" makes, so both appear under Activity.
 *
 * Un-saving only removes an entry that is still just saved. Once it has moved
 * on (applied, interviewing…) it is the person's record of an application,
 * and a bookmark click must not delete it.
 */
export function useMatchSave(m: MatchedJob) {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const isPlatform = m.source === "platform" && m.id.startsWith(PLATFORM_PREFIX);
  const platformId = m.id.slice(PLATFORM_PREFIX.length);
  const sourceKey = `match:${m.id}`;

  const { data: savedJobs } = useQuery({
    queryKey: SAVED_KEY,
    queryFn: getMySavedJobs,
    enabled: isAuthenticated && isPlatform,
    staleTime: 60_000,
  });
  const { data: tracked } = useQuery({
    queryKey: EXTERNAL_KEY,
    queryFn: getExternalApplications,
    enabled: isAuthenticated && !isPlatform,
    staleTime: 60_000,
  });

  // The server files a tracker entry under its URL when it has one (so the
  // matcher, a Coral job and a manual entry for the same link are one row),
  // and under the source key only when it hasn't. Compare URLs the way the
  // server stores them.
  const url = normalizedUrl(m.url);
  const entry = isPlatform
    ? undefined
    : tracked?.find((t) => (url ? normalizedUrl(t.url ?? undefined) === url : t.sourceKey === sourceKey));
  const isSaved = isPlatform ? !!savedJobs?.some((s) => s.id === platformId) : !!entry;

  const mutation = useMutation({
    mutationFn: async () => {
      if (isPlatform) {
        await (isSaved ? unsaveJob(platformId) : saveJob(platformId));
        return isSaved ? "removed" : "saved";
      }
      if (!entry) {
        await createExternalApplication({ sourceKey, title: m.title, company: m.company, url: m.url, status: "saved" });
        return "saved";
      }
      if (entry.status !== "saved") return "kept";
      await deleteExternalApplication(entry.id);
      return "removed";
    },
    onSuccess: (outcome) => {
      if (outcome === "saved") toast.success(isPlatform ? "Saved" : "Saved to your External tracker");
      if (outcome === "removed") toast.success("Removed from saved");
      if (outcome === "kept") toast.info("This one is in your tracker as an application. Manage it under Activity.");
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => queryClient.invalidateQueries({ queryKey: isPlatform ? SAVED_KEY : EXTERNAL_KEY }),
  });

  return { isSaved, toggle: () => mutation.mutate(), isPending: mutation.isPending };
}
