import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import Header from "@/components/Header";
import { Skeleton } from "@/components/ui/skeleton";
import { TideCard } from "@/components/community/tides/TideCard";
import { getTide } from "@/lib/api/tides";

/** One tide on its own — where a card, a notification or a calendar file lands. */
export default function TidePage() {
  const { tideId } = useParams<{ tideId: string }>();
  const tide = useQuery({
    queryKey: ["tides", tideId],
    queryFn: () => getTide(tideId!),
    enabled: !!tideId,
    retry: false,
  });

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-24 sm:px-6">
        <Link
          to="/community"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to the community
        </Link>

        {tide.isLoading && <Skeleton className="h-64 rounded-xl" />}

        {tide.isError && (
          <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-destructive">This tide isn't available</p>
              <p className="mt-1 text-sm text-destructive/90">
                It may have been removed since you were linked to it.
              </p>
            </div>
          </div>
        )}

        {tide.data && <TideCard tide={tide.data} />}
      </main>
    </>
  );
}
