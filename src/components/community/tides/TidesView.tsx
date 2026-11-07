import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TideListSkeleton } from "@/components/community/feed/skeletons";
import { cn } from "@/lib/utils";
import { listTides } from "@/lib/api/tides";
import { TideCard } from "./TideCard";

/**
 * Everything coming up, and what already happened.
 *
 * Upcoming leads and is the default: a listing whose first item was last March
 * reads as abandoned however much is underneath it. Past is a deliberate
 * click, for someone checking whether a company actually holds these.
 */
export function TidesView() {
  const [past, setPast] = useState(false);
  const [page, setPage] = useState(1);

  const tides = useQuery({
    queryKey: ["tides", "list", past, page],
    queryFn: () => listTides({ past, page }),
    retry: false,
  });

  const items = tides.data?.data ?? [];
  const meta = tides.data?.meta;

  return (
    <div>
      <header className="mb-5">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Tides</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Webinars, open days, hiring events and hours with a team. Catch one.
        </p>
      </header>

      <div className="mb-5 flex gap-1.5">
        {[
          { label: "Coming up", value: false },
          { label: "Already happened", value: true },
        ].map((tab) => (
          <button
            key={tab.label}
            type="button"
            onClick={() => {
              setPast(tab.value);
              setPage(1);
            }}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              past === tab.value
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {tides.isLoading && <TideListSkeleton />}

      {tides.isError && (
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-destructive">Couldn't load tides</p>
            <p className="mt-1 text-sm text-destructive/90">{(tides.error as Error).message}</p>
          </div>
        </div>
      )}

      {tides.data && items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <CalendarDays className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium">
            {past ? "Nothing has happened yet" : "Nothing coming up"}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            {past
              ? "Once tides have been and gone, they will be listed here."
              : "When someone holds a webinar, an open day or an hour with their team, it appears here."}
          </p>
        </div>
      )}

      <div className="space-y-3">
        {items.map((tide) => (
          <TideCard key={tide.id} tide={tide} />
        ))}
      </div>

      {meta && meta.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
            disabled={page <= 1 || tides.isFetching}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {meta.page} of {meta.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= meta.totalPages || tides.isFetching}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

export default TidesView;
