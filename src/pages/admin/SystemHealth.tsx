import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { RefreshCw, CheckCircle2, ExternalLink, AlertTriangle } from "lucide-react";
import { MiniChart } from "@/components/adminDashboard/system-health/MiniChart";
import { IncidentPanel } from "@/components/adminDashboard/system-health/IncidentPanel";
import type {
  PerformanceMetric,
  Incident,
  QueueInfo,
} from "@/data/admin/system-health/system-health";
import { cn } from "@/lib/utils";
import { runScheduledJob, useSystemHealth, type RunJobOutcome } from "@/hooks/admin/useAdminSystemHealth";
import { toast } from "sonner";

// ── Sample data (sections not yet instrumented) ──────────────────────────────

const metrics: PerformanceMetric[] = [
  { label: "API Response Time", value: "120", unit: "ms", change: "-4%", changeDirection: "down", data: [130, 128, 125, 122, 120, 118, 121, 119, 120, 122, 118, 120] },
  { label: "Error Rate", value: "0.4", unit: "%", change: "+0.1%", changeDirection: "up", data: [0.3, 0.3, 0.4, 0.5, 0.4, 0.3, 0.4, 0.4, 0.5, 0.4, 0.3, 0.4] },
  { label: "Requests / min", value: "2,847", unit: "rpm", change: "+12%", changeDirection: "up", data: [2400, 2500, 2600, 2700, 2800, 2900, 2847, 2800, 2750, 2900, 2847, 2847] },
  { label: "Job Processing", value: "340", unit: "ms", change: "-8%", changeDirection: "down", data: [380, 370, 360, 350, 345, 340, 338, 342, 340, 335, 340, 340] },
  { label: "Queue Size", value: "124", unit: "jobs", change: "+3", changeDirection: "neutral", data: [110, 115, 120, 118, 125, 130, 128, 124, 120, 122, 126, 124] },
  { label: "Active Users", value: "1,842", unit: "", change: "+5%", changeDirection: "up", data: [1700, 1720, 1750, 1780, 1800, 1820, 1840, 1842, 1830, 1850, 1842, 1842] },
];

const incidents: Incident[] = [
  {
    id: "inc-1",
    title: "Email delivery delay",
    severity: "medium",
    status: "resolved",
    startedAt: "Mar 25, 14:32",
    resolvedAt: "Mar 25, 15:10",
    duration: "38 min",
    description: "Outbound email queue experienced delays due to SMTP provider throttling.",
    affectedSystems: ["Email Service", "Queue Workers"],
    timeline: [
      { time: "14:32", message: "Alert triggered: email queue depth > 500" },
      { time: "15:10", message: "Queue cleared, normal operations resumed" },
    ],
    resolutionNotes: "Switched to backup SMTP relay. Primary provider ticket opened.",
    assignedAdmin: "Sarah K.",
  },
  {
    id: "inc-3",
    title: "Database connection pool exhaustion",
    severity: "critical",
    status: "resolved",
    startedAt: "Mar 23, 02:10",
    resolvedAt: "Mar 23, 02:45",
    duration: "35 min",
    description: "Connection pool maxed out due to long-running analytics query.",
    affectedSystems: ["Database", "API"],
    timeline: [
      { time: "02:10", message: "Connection pool utilization hit 100%" },
      { time: "02:45", message: "All connections restored" },
    ],
    resolutionNotes: "Added query timeout limits. Analytics queries moved to read replica.",
    assignedAdmin: "Sarah K.",
  },
];

const queues: QueueInfo[] = [
  { name: "email", pending: 23, processingRate: "120/min", failures: 0, status: "healthy" },
  { name: "notifications", pending: 8, processingRate: "200/min", failures: 1, status: "healthy" },
  { name: "file-processing", pending: 45, processingRate: "15/min", failures: 3, status: "degraded" },
  { name: "analytics", pending: 312, processingRate: "50/min", failures: 0, status: "backlogged" },
];

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

const queueStatusBadge: Record<string, string> = {
  healthy: "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20",
  degraded: "bg-amber-500/10 text-amber-600 border border-amber-500/20",
  backlogged: "bg-rose-500/10 text-rose-600 border border-rose-500/20",
};

const severityBadge: Record<string, string> = {
  low: "bg-slate-100 text-slate-600 border border-slate-200",
  medium: "bg-amber-500/10 text-amber-600 border border-amber-500/20",
  high: "bg-orange-500/10 text-orange-600 border border-orange-500/20",
  critical: "bg-rose-500/10 text-rose-600 border border-rose-500/20",
};

const incidentStatusBadge: Record<string, string> = {
  investigating: "bg-amber-500/10 text-amber-600 border border-amber-500/20",
  identified: "bg-blue-500/10 text-blue-600 border border-blue-500/20",
  monitoring: "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20",
  resolved: "bg-slate-100 text-slate-600 border border-slate-200",
};

function SectionTitle({ children, sample }: { children: React.ReactNode; sample?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{children}</h2>
      {sample && (
        <Badge variant="outline" className="text-[10px] font-normal text-amber-600 border-amber-300 bg-amber-50">
          Sample data · not instrumented
        </Badge>
      )}
    </div>
  );
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
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState("24h");
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
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
              Monitor platform performance, uptime, and background systems
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

            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[120px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Last 1h</SelectItem>
                <SelectItem value="24h">Last 24h</SelectItem>
                <SelectItem value="7d">Last 7d</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-9 rounded-full" onClick={() => navigate("/system-health/logs")}>
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Logs
            </Button>
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

        {/* ── Section 1: System Status (real) ── */}
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

        {/* ── Section 2: Performance Metrics (sample) ── */}
        <section className="space-y-3">
          <SectionTitle sample>Performance Metrics</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {metrics.map((m) => (
              <div key={m.label} className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
                <div>
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                  <p className="text-xl font-semibold tracking-tight mt-0.5">
                    {m.value}
                    {m.unit && <span className="text-xs font-normal text-muted-foreground ml-1">{m.unit}</span>}
                  </p>
                  {m.change && (
                    <p className={cn(
                      "text-xs mt-0.5",
                      m.changeDirection === "down" ? "text-status-operational-foreground" : m.changeDirection === "up" && m.label === "Error Rate" ? "text-destructive" : "text-muted-foreground"
                    )}>
                      {m.change}
                    </p>
                  )}
                </div>
                <MiniChart data={m.data} className="opacity-60" />
              </div>
            ))}
          </div>
        </section>

        {/* ── Section 3: Incidents & Alerts (sample) ── */}
        <section className="space-y-3">
          <SectionTitle sample>Incidents &amp; Alerts</SectionTitle>
          <div className="rounded-lg border border-border bg-card shadow-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/50">
                  <TableHead>Incident</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Resolved</TableHead>
                  <TableHead>Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incidents.map((inc) => (
                  <TableRow
                    key={inc.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/admin/system-health/incidents/${inc.id}`)}
                  >
                    <TableCell className="font-medium">{inc.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-xs capitalize", severityBadge[inc.severity])}>
                        {inc.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-xs capitalize", incidentStatusBadge[inc.status])}>
                        {inc.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{inc.startedAt}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{inc.resolvedAt ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{inc.duration}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        {/* ── Section 4: Background Jobs (real) ── */}
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

        {/* ── Section 5 & 6: Database / Storage (real) & Auth (sample) ── */}
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

          {/* Auth & Security (real) */}
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

        {/* ── Section 7: Queue & Workers (sample) ── */}
        <section className="space-y-3">
          <SectionTitle sample>Queue &amp; Workers</SectionTitle>
          <div className="rounded-lg border border-border bg-card shadow-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/50">
                  <TableHead>Queue</TableHead>
                  <TableHead>Pending</TableHead>
                  <TableHead>Processing Rate</TableHead>
                  <TableHead>Failures</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queues.map((q) => (
                  <TableRow key={q.name}>
                    <TableCell className="font-medium font-mono text-sm">{q.name}</TableCell>
                    <TableCell className="text-sm">{q.pending}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{q.processingRate}</TableCell>
                    <TableCell className={cn("text-sm", q.failures > 0 && "text-destructive font-medium")}>{q.failures}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-xs capitalize", queueStatusBadge[q.status])}>
                        {q.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>

      {/* Incident Detail Panel */}
      <IncidentPanel
        incident={selectedIncident}
        open={!!selectedIncident}
        onOpenChange={(open) => !open && setSelectedIncident(null)}
      />
    </>
  );
}
