import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { getTide } from "@/lib/api/tides";
import { TideCard } from "./TideCard";

/**
 * The tide attached to a TIDE post, fetched rather than embedded.
 *
 * Deliberately a second request. A tide carries a join URL that the server
 * releases only to people who are going, an hour before the start — embedding
 * the tide in the feed payload would mean re-implementing that gate inside the
 * post query, and getting it wrong there would publish a meeting link to
 * everyone. Asking the tide endpoint means the gate is applied once, where it
 * lives. React Query keys it by tide id, so a tide announced in several posts
 * is fetched once.
 */
export function TidePostCard({ tideId }: { tideId: string }) {
  const tide = useQuery({
    queryKey: ["tides", tideId],
    queryFn: () => getTide(tideId),
    staleTime: 60_000,
    retry: false,
  });

  if (tide.isLoading) return <Skeleton className="mt-3 h-40 rounded-xl" />;

  // A deleted tide leaves the post that announced it standing; the post is
  // still someone's words.
  if (tide.isError || !tide.data) return null;

  return (
    <div className="mt-3">
      <TideCard tide={tide.data} />
    </div>
  );
}

export default TidePostCard;
