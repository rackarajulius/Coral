import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { monthLabel } from "@/lib/api/profileProjects";
import type { DoneWorkSummary } from "@/lib/api/marketplace";

/**
 * Work done through Coral: requests both sides confirmed as finished. What it
 * says is what Coral recorded — the service, the month, and the client only
 * when the client agreed to be named.
 */
export function DoneWorkList({ work, currentServiceId }: {
  work: DoneWorkSummary;
  /** On a service's page: its id, so its own entries don't link back to it. */
  currentServiceId?: string;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {work.total === 1 ? "1 piece of work" : `${work.total} pieces of work`} done through Coral, each confirmed by both the client and the provider.
      </p>
      <ul className="space-y-2">
        {work.items.map((item) => (
          <li key={item.id} className="flex items-start gap-2 text-sm">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="min-w-0 break-words">
              {item.serviceId && item.serviceId !== currentServiceId ? (
                <Link to={`/services/${item.serviceId}?source=profile`} className="font-medium text-link hover:underline">{item.title}</Link>
              ) : (
                <span className="font-medium">{item.title ?? (item.kind === "project" ? "A client's project" : "A service")}</span>
              )}
              <span className="text-muted-foreground"> · {monthLabel(item.month)} · {item.client ? `for ${item.client}` : "for a client"}</span>
            </span>
          </li>
        ))}
      </ul>
      {work.total > work.items.length && <p className="text-xs text-muted-foreground">Showing the latest {work.items.length}.</p>}
    </div>
  );
}

export default DoneWorkList;
