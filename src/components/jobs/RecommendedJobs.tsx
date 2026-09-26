import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Sparkles, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  dismissRecommendation,
  getRecommendedJobs,
  undismissRecommendation,
  type RecommendedJob,
} from "@/lib/api/recommendations";

const COLLAPSED = 3;

/**
 * "Picked for you" — jobs matched to what the seeker put on their profile.
 *
 * Every item says why it is here, and any of them can be waved away for good.
 * Paid placements are labelled "Promoted"; they only appear when they match
 * as well as anything else would, and there are never more than two.
 */
export default function RecommendedJobs({ onSelect }: { onSelect: (jobId: string) => void }) {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const isSeeker = isAuthenticated && !!user && !user.provisional && user.role === "JOB_SEEKER";
  const queryKey = ["recommended-jobs", user?.id];

  const { data } = useQuery({
    queryKey,
    queryFn: () => getRecommendedJobs(10),
    enabled: isSeeker,
    staleTime: 5 * 60_000,
    retry: false,
  });

  if (!isSeeker || !data) return null;

  if (data.needsProfile) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-4 text-sm">
        <p className="flex items-center gap-2 font-medium text-foreground">
          <Sparkles className="h-4 w-4 text-coral" /> Get jobs picked for you
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Add your skills or current title to your{" "}
          <Link to="/jobseeker/profile" className="text-coral hover:underline">
            profile
          </Link>{" "}
          and we'll match new jobs to them.
        </p>
      </div>
    );
  }

  if (data.items.length === 0) return null;

  const visible = expanded ? data.items : data.items.slice(0, COLLAPSED);

  const dismiss = async (item: RecommendedJob) => {
    queryClient.setQueryData(queryKey, {
      ...data,
      items: data.items.filter((i) => i.jobId !== item.jobId),
    });
    try {
      await dismissRecommendation(item.jobId);
      toast("We won't suggest that job again.", {
        action: {
          label: "Undo",
          onClick: async () => {
            await undismissRecommendation(item.jobId).catch(() => undefined);
            void queryClient.invalidateQueries({ queryKey });
          },
        },
      });
    } catch {
      toast.error("Couldn't hide that job. Try again.");
      void queryClient.invalidateQueries({ queryKey });
    }
  };

  return (
    <section aria-label="Jobs picked for you" className="rounded-xl border border-border bg-card p-3 sm:p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Sparkles className="h-4 w-4 text-coral" /> Picked for you
        </h2>
        <span className="text-[11px] text-muted-foreground">From your profile's skills and preferences</span>
      </div>

      <ul className="space-y-1.5">
        {visible.map((item) => (
          <li key={item.jobId} className="group relative">
            <button
              type="button"
              onClick={() => onSelect(item.jobId)}
              className="w-full rounded-lg border border-transparent p-2.5 pr-9 text-left transition hover:border-coral/30 hover:bg-coral/5"
            >
              <div className="flex items-baseline gap-2">
                <span className="truncate text-sm font-medium text-foreground">{item.title}</span>
                {item.promoted && (
                  <span
                    className="shrink-0 rounded border border-border px-1 text-[10px] uppercase tracking-wide text-muted-foreground"
                    title="The employer paid to reach more people. It's shown because it matches you, like everything here."
                  >
                    Promoted
                  </span>
                )}
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {item.company}
                {item.isRemote ? " · Remote" : item.location ? ` · ${item.location}` : ""}
              </p>
              <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{item.reasons.slice(0, 2).join(" · ")}</p>
            </button>
            <button
              type="button"
              onClick={() => void dismiss(item)}
              aria-label={`Not interested in ${item.title}`}
              title="Not interested"
              className={cn(
                "absolute right-1.5 top-2 rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground",
                "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100",
              )}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>

      {data.items.length > COLLAPSED && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 flex items-center gap-1 text-xs font-medium text-coral hover:underline"
        >
          {expanded ? (
            <>
              Show fewer <ChevronUp className="h-3 w-3" />
            </>
          ) : (
            <>
              Show {data.items.length - COLLAPSED} more <ChevronDown className="h-3 w-3" />
            </>
          )}
        </button>
      )}
    </section>
  );
}
