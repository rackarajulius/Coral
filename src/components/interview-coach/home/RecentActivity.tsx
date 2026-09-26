import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { interviewTypeLabel } from "@/data/interview-coach/constants";
import type { HistoryEntry } from "@/data/interview-coach/types";

export default function RecentActivity({ entries }: { entries: HistoryEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <section
      aria-labelledby="recent-activity-heading"
      className="rounded-2xl border border-gray-300 bg-card p-5"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 id="recent-activity-heading" className="font-display text-base font-semibold text-ink">
          Recent Activity
        </h2>
        <Link
          to="/interview-prep/history"
          className="rounded text-sm font-medium text-coral hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          View all
        </Link>
      </div>

      <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
        {entries.slice(0, 6).map((e) => (
          <li key={e.id}>
            <Link
              to={`/interview-prep/report/${e.id}`}
              className="block rounded-xl p-2.5 transition-colors hover:bg-coral/400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="block text-sm leading-snug text-ink">
                {interviewTypeLabel(e.config.type)} interview completed for{" "}
                <span className="font-semibold">{e.config.role}</span> — scored{" "}
                <span className="font-semibold">{e.overallScore}</span>
              </span>
              <span className="mt-0.5 block text-xs text-ink-dim">
                {formatDistanceToNow(new Date(e.createdAt), { addSuffix: true })}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
