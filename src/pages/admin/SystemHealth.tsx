import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { runScheduledJob, useSystemHealth, type RunJobOutcome } from "@/hooks/admin/useAdminSystemHealth";
import { toast } from "sonner";

// ── Helpers ──────────────────────────────────────────────────────────────────

const statusDot: Record<string, string> = {
  operational: "bg-emerald-500",
  degraded: "bg-amber-500",
  down: "bg-rose-500",
};

const jobStatusBadge: Record<string, string> = {
  running: "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20",
  completed: "bg-slate-100 text-slate-600 border border-slate-200",
  failed: "bg-rose-500/10 text-rose-600 border border-rose-500/20",
  overdue: "bg-amber-500/10 text-amber-600 border border-amber-500/20",
  scheduled: "bg-blue-500/10 text-blue-600 border border-blue-500/20",
};

/** What a manual run came back with, in words. */
function describeRun(outcome: RunJobOutcome): string {
  if (!("reason" in outcome)) {
    return outcome.status === "ok"
      ? `Finished in ${(outcome.durationMs / 1000).toFixed(1)}s.`
      : `Failed: ${outcome.error ?? "unknown error"}`;
  }
  switch (outcome.reason) {
    case "running":
      return "Already running on a server — not started twice.";
    case "disabled":
      return "Scheduled jobs are switched off on this server.";
    default:
      return "Couldn't claim the job; try again.";
  }
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{children}</h2>;
}

function fmtRelative(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = d.getTime() - Date.now();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  const hrs = Math.round(abs / 3600000);
  const days = Math.round(abs / 86400000);
  const unit = mins < 1 ? "now" : mins < 60 ? `${mins}m` : hrs < 24 ? `${hrs}h` : `${days}d`;
  if (mins < 1) return "just now";
  return diff >= 0 ? `in ${unit}` : `${unit} ago`;
}

const REFRESH_INTERVALS = [
  { label: "5s", value: 5000 },
  { label: "10s", value: 10000 },
  { label: "30s", value: 30000 },
  { label: "1m", value: 60000 },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SystemHealthPage() {
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(10000);

  const { data, isLoading, isFetching, refetch } = useSystemHealth(autoRefresh ? refreshInterval : false);
  const [runningKey, setRunningKey] = useState<string | null>(null);

  const runNow = async (key: string) => {
    setRunningKey(key);
    try {
      const outcome = await runScheduledJob(key);
      const message = describeRun(outcome);
      if (!("reason" in outcome) && outcome.status === "ok") toast.success(message);
      else toast.error(message);
      void refetch();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRunningKey(null);
    }
  };

  const services = data?.services ?? [];
  const jobs = data?.jobs ?? [];
  const db = data?.database;
  const storage = data?.storage;
  const allOperational = services.length > 0 && services.every((s) => s.status === "operational");
  const lastRefreshed = data?.generatedAt ? new Date(data.generatedAt) : null;

  const dbRows = [
    { label: "Query latency", value: db?.latencyMs != null ? `${db.latencyMs}ms` : "—" },
    { label: "Active connections", value: db?.activeConnections != null ? String(db.activeConnections) : "—" },
    { label: "Database size", value: db?.size ?? "—" },
  ];
  const storageRows = [
    { label: "Buckets", value: storage ? String(storage.buckets) : "—" },
    { label: "Probe latency", value: storage?.latencyMs != null ? `${storage.latencyMs}ms` : "—" },
    { label: "Status", value: storage ? storage.status : "—" },
  ];
  const acct = data?.accounts;
  const authRows = [
    { label: "Active (24h)", value: acct ? String(acct.active24h) : "—" },
    { label: "New signups (24h)", value: acct ? String(acct.new24h) : "—" },
    { label: "Email verified", value: acct ? `${acct.verifiedRate}%` : "—" },
    { label: "Suspended / banned", value: acct ? String(acct.suspendedOrBanned) : "—", alert: !!acct && acct.suspendedOrBanned > 0 },
    { label: "Admins", value: acct ? String(acct.admins) : "—" },
    { label: "Total accounts", value: acct ? String(acct.total) : "—" },
  ];

  return (
    <>
      <div className="space-y-8 p-6 md:p-8">
        {/* ── Header ── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">System Health</h1>
            <p className="text-muted-foreground mt-1">
              Live checks of the services, database, storage and scheduled jobs
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Auto-refresh controls */}
            <div className="flex items-center gap-1.5 rounded-md border border-border px-2 h-9">
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={cn(
                  "relative h-5 w-9 rounded-full transition-colors",
                  autoRefresh ? "bg-green-500" : "bg-secondary"
                )}
              >
                <span className={cn(
                  "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-card transition-transform shadow-sm",
                  autoRefresh && "translate-x-4"
                )} />
              </button>
              <span className="text-xs text-muted-foreground whitespace-nowrap">Auto</span>
              {autoRefresh && (
                <Select value={String(refreshInterval)} onValueChange={(v) => setRefreshInterval(Number(v))}>
                  <SelectTrigger className="h-7 w-[60px] text-xs border-0 bg-transparent px-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REFRESH_INTERVALS.map((i) => (
                      <SelectItem key={i.value} value={String(i.value)}>{i.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <Button variant="outline" size="sm" className="h-9 rounded-full" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", isFetching && "animate-spin")} /> Refresh
            </Button>
            <div className={cn(
              "flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md",
              allOperational ? "bg-status-operational/10 text-status-operational-foreground" : "bg-destructive/20 text-destructive"
            )}>
              {allOperational ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
              {isLoading ? "Checking…" : allOperational ? "All systems operational" : "Issues detected"}
            </div>
          </div>
          {/* Last refreshed */}
          <p className="text-xs text-muted-foreground text-right">
            {lastRefreshed ? `Updated ${lastRefreshed.toLocaleTimeString()}` : "Loading…"}
            {autoRefresh && <span className="ml-1">· auto-refreshing</span>}
          </p>
        </div>

        {/* ── System Status ── */}
        <section className="space-y-3">
          <SectionTitle>System Status</SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {(isLoading ? Array.from({ length: 6 }).map((_, i) => ({ name: "", status: "operational" as const, latency: "", _sk: i })) : services).map((s, i) => (
              <TooltipProvider key={s.name || i}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2.5 rounded-lg border border-border bg-card p-3">
                      {isLoading ? (
                        <div className="h-2 w-2 rounded-full bg-muted animate-pulse shrink-0" />
                      ) : (
                        <span className={cn("h-2 w-2 rounded-full shrink-0", statusDot[s.status])} />
                      )}
                      <div className="min-w-0">
                        {isLoading ? (
                          <>
                            <div className="h-4 w-16 bg-muted animate-pulse rounded" />
                            <div className="h-3 w-10 bg-muted animate-pulse rounded mt-1" />
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-medium truncate">{s.name}</p>
                            <p className="text-xs text-muted-foreground">{s.latency}</p>
                          </>
                        )}
                      </div>
                    </div>
                  </TooltipTrigger>
                  {!isLoading && (
                    <TooltipContent>{s.status.charAt(0).toUpperCase() + s.status.slice(1)}</TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        </section>

        {/* ── Background Jobs ── */}
        <section className="space-y-3">
          <SectionTitle>Background Jobs</SectionTitle>
          <div className="rounded-lg border border-border bg-card shadow-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/50">
                  <TableHead>Job Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Run</TableHead>
                  <TableHead>Next Run</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-sm text-muted-foreground">Loading…</TableCell>
                  </TableRow>
                ) : jobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-sm text-muted-foreground">No scheduled jobs registered.</TableCell>
                  </TableRow>
                ) : (
                  jobs.map((job) => (
                    <TableRow key={job.key ?? job.name}>
                      <TableCell className="font-medium">{job.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-xs capitalize", jobStatusBadge[job.status] ?? jobStatusBadge.scheduled)}>
                          {job.status}
                        </Badge>
                        {job.lastError && job.status === "failed" && (
                          <p className="mt-1 max-w-xs truncate text-xs text-rose-600" title={job.lastError}>
                            {(job.consecutiveFailures ?? 0) > 1 ? `${job.consecutiveFailures} failures in a row · ` : ""}
                            {job.lastError}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{fmtRelative(job.lastRun)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{fmtRelative(job.nextRun)}</TableCell>
                      <TableCell className="text-right">
                        {job.key && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={runningKey !== null || job.status === "running"}
                            onClick={() => void runNow(job.key!)}
                          >
                            {runningKey === job.key ? "Running…" : "Run now"}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        {/* ── Database / Storage / Auth ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Database */}
          <section className="space-y-3">
            <SectionTitle>Database</SectionTitle>
            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
              {dbRows.map((m) => (
                <div key={m.label} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{m.label}</span>
                  <span className="text-sm font-medium capitalize">{m.value}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Storage */}
          <section className="space-y-3">
            <SectionTitle>Storage</SectionTitle>
            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
              {storageRows.map((m) => (
                <div key={m.label} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{m.label}</span>
                  <span className="text-sm font-medium capitalize">{m.value}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Auth & Security */}
          <section className="space-y-3">
            <SectionTitle>Auth &amp; Security</SectionTitle>
            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
              {authRows.map((m) => (
                <div key={m.label} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{m.label}</span>
                  <span className={cn("text-sm font-medium", m.alert && "text-destructive")}>{m.value}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

      </div>
    </>
  );
}
