import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getPostStats } from "@/lib/api/community";
import { ViewsChart } from "./ViewsChart";

/**
 * How far one post travelled, for its author — or, on a company post, for the
 * people who run the page. Nobody else can open it, and it names no reader.
 */
export function PostStatsDialog({
  postId,
  open,
  onOpenChange,
  forCompany,
}: {
  postId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The company's name, on a company post. */
  forCompany?: string | null;
}) {
  const stats = useQuery({
    queryKey: ["post-stats", postId],
    queryFn: () => getPostStats(postId),
    enabled: open,
    staleTime: 60_000,
    retry: false,
  });
  const s = stats.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Post stats</DialogTitle>
          <DialogDescription>
            {forCompany
              ? `Only ${forCompany}'s page owners and admins see these.`
              : "Only you see these."}{" "}
            A view is someone having the post on screen, once a day each; the {forCompany ? "company's team" : "author"} never counts.
          </DialogDescription>
        </DialogHeader>

        {stats.isLoading && (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Loading stats" />
          </div>
        )}
        {stats.isError && <p className="py-6 text-sm text-destructive">{(stats.error as Error).message}</p>}

        {s && (
          <div className="space-y-5">
            <div>
              <p className="text-xs text-muted-foreground">Views</p>
              <p className="text-5xl font-semibold tabular-nums tracking-tight">{s.views.toLocaleString()}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {s.peopleReached.toLocaleString()} {s.peopleReached === 1 ? "person" : "different people"} in the last {s.retentionDays} days
              </p>
            </div>

            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Tile label="Reactions" value={s.reactions} />
              <Tile label="Comments" value={s.comments} />
              <Tile label="Reshares" value={s.reshares} />
              <Tile label="Engagement" value={s.engagementRate === null ? "–" : `${s.engagementRate}%`} />
            </dl>

            <ViewsChart daily={s.daily} caption={s.daily.length > 1 ? `Views by day, last ${s.daily.length} days` : "Views today"} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Tile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums">{typeof value === "number" ? value.toLocaleString() : value}</dd>
    </div>
  );
}

export default PostStatsDialog;
