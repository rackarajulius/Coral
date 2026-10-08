import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getJobsAnalytics } from "@/lib/api/employerAnalytics";
import { useAnalyticsRange } from "./AnalyticsRange";

/**
 * Per-job performance.
 *
 * The mock had "Clicks" and "Qualified" columns. Clicks aren't attributed per
 * job (apply clicks are captured, but a job-level click-through rate needs the
 * view and the click paired, which the current events don't guarantee), and
 * "Qualified" had no definition anywhere — it was a number with no meaning.
 * Both columns are gone rather than filled with something plausible.
 */
const JobsTable = ({ compact = false, search = "", onSelectJob }: { compact?: boolean; search?: string; onSelectJob?: (job: { id: string; title: string }) => void }) => {
  const { days } = useAnalyticsRange();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["employer-analytics-jobs", days],
    queryFn: () => getJobsAnalytics(days),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 w-full rounded" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return <p className="py-6 text-center text-sm text-destructive">Couldn't load job performance.</p>;
  }

  const all = data.rows.filter((job) => job.title.toLowerCase().includes(search.trim().toLowerCase()));
  const rows = compact ? all.slice(0, 5) : all;

  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {search ? "No jobs match your search." : "No jobs posted yet. Post a role to start seeing performance here."}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Job</TableHead>
            {!compact && <TableHead>Department</TableHead>}
            <TableHead className="text-right">Views</TableHead>
            <TableHead className="text-right">Apps</TableHead>
            <TableHead className="text-right">Interview stage</TableHead>
            <TableHead className="text-right">Hires</TableHead>
            <TableHead className="text-right">Conv.</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((j) => (
            <TableRow key={j.id} className="hover:bg-muted/50">
              <TableCell>
                {onSelectJob ? (
                  <button type="button" className="font-medium text-left hover:underline" onClick={() => onSelectJob({ id: j.id, title: j.title })}>{j.title}</button>
                ) : <p className="font-medium">{j.title}</p>}
                {compact && j.department && (
                  <p className="text-[11px] text-muted-foreground">{j.department}</p>
                )}
              </TableCell>
              {!compact && (
                <TableCell className="text-muted-foreground">{j.department ?? "—"}</TableCell>
              )}
              <TableCell className="text-right tabular-nums">
                {j.views.toLocaleString()}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {j.applications.toLocaleString()}
              </TableCell>
              <TableCell className="text-right tabular-nums">{j.interviews}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">{j.hires}</TableCell>
              <TableCell className="text-right">
                {/* Null when there were no views to convert — a dash, not 0%. */}
                {j.conversion === null ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <Badge variant="default" className="tabular-nums">
                    {j.conversion}%
                  </Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!compact && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          {data.rows.length === 100 && "Showing the latest 100 jobs. "}
          Views are counted from when page tracking began, so older roles may show fewer views
          than they actually received.
        </p>
      )}
    </div>
  );
};

export default JobsTable;
