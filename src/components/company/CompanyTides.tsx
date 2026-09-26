import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TideCard } from "@/components/community/tides/TideCard";
import { listTides } from "@/lib/api/tides";
import type { EmployerCompany } from "@/lib/api/employerCompany";

/** How many to show before handing over to the full list. */
const SHOWN = 3;

/**
 * What this company is holding.
 *
 * Note which id this asks with. The page's route param is an **EmployerProfile**
 * id, while a tide belongs to a **Company** — two different rows, both UUIDs,
 * and asking with the wrong one returns an empty list rather than an error. An
 * employer profile with no company behind it can have no tides, so the section
 * does not render at all.
 */
export function CompanyTides({ company }: { company?: EmployerCompany }) {
  const companyId = company?.companyId ?? null;

  const tides = useQuery({
    queryKey: ["tides", "company", companyId],
    queryFn: () => listTides({ companyId: companyId!, limit: SHOWN + 1 }),
    enabled: !!companyId,
    staleTime: 5 * 60_000,
    retry: false,
  });

  if (!companyId) return null;
  if (tides.isLoading) return <Skeleton className="h-48 rounded-2xl" />;

  const all = tides.data?.data ?? [];
  // Nothing coming up is not a section. An empty "Tides" heading on a careers
  // page reads as neglect, the same way a stale posts wall does.
  if (all.length === 0) return null;

  const shown = all.slice(0, SHOWN);
  const more = (tides.data?.meta.total ?? 0) - shown.length;

  return (
    <Card id="tides" className="border-border/50 rounded-2xl scroll-mt-28">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Coming up</CardTitle>
        <p className="text-sm text-muted-foreground">
          Webinars, open days and hiring events {company?.companyName} is holding.
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        {shown.map((tide) => (
          <TideCard key={tide.id} tide={tide} compact />
        ))}

        {more > 0 && (
          <Link
            to="/community/tides"
            className="inline-block text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            {more} more {more === 1 ? "tide" : "tides"}
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

export default CompanyTides;
