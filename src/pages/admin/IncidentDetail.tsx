import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { MiniChart } from "@/components/adminDashboard/system-health/MiniChart";
import {
  ArrowLeft,
  AlertTriangle,
  Send,
  Clock,
  Radio,
  Shield,
  Zap,
  CheckCircle2,
  ArrowUpRight,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { IncidentStatus, IncidentSeverity } from "@/data/admin/system-health/system-health";


// ── Types ──

interface TimelineEvent {
  time: string;
  title: string;
  description: string;
  type: "alert" | "action" | "deploy" | "info" | "resolve";
}

interface AffectedService {
  name: string;
  status: "operational" | "degraded" | "down";
  responseTime: string;
  errors: number;
}

interface Note {
  id: string;
  admin: string;
  timestamp: string;
  text: string;
}

// ── Sample Data ──

const incidentsData: Record<string, {
  id: string;
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  startedAt: string;
  duration: string;
  region: string;
  description: string;
  affectedServiceNames: string[];
  timeline: TimelineEvent[];
  affectedServices: AffectedService[];
  notes: Note[];
  resolution: { rootCause: string; fix: string; preventive: string } | null;
  assignedAdmin: string;
  metricsLatency: number[];
  metricsErrorRate: number[];
  metricsRequests: number[];
}> = {
  "inc-1": {
    id: "inc-1",
    title: "Email delivery delay",
    severity: "medium",
    status: "resolved",
    startedAt: "Mar 25, 2025 · 14:32 UTC",
    duration: "38 min",
    region: "Canada (ca-central-1)",
    description: "Outbound email queue experienced delays due to SMTP provider throttling, affecting transactional emails including job alerts and verification emails.",
    affectedServiceNames: ["Email Service", "Queue Workers"],
    timeline: [
      { time: "14:32", title: "Alert triggered", description: "Email queue depth exceeded 500 threshold", type: "alert" },
      { time: "14:35", title: "On-call acknowledged", description: "Sarah K. acknowledged the alert", type: "action" },
      { time: "14:38", title: "Investigation started", description: "Checking SMTP connection pool and provider status", type: "info" },
      { time: "14:55", title: "Root cause identified", description: "SMTP provider rate limiting due to spike in transactional volume", type: "info" },
      { time: "15:05", title: "Fix deployed", description: "Switched to backup SMTP relay (Postmark)", type: "deploy" },
      { time: "15:10", title: "Incident resolved", description: "Queue cleared, normal operations resumed", type: "resolve" },
    ],
    affectedServices: [
      { name: "Email Service", status: "operational", responseTime: "210ms", errors: 0 },
      { name: "Queue Workers", status: "operational", responseTime: "15ms", errors: 0 },
      { name: "API", status: "operational", responseTime: "120ms", errors: 0 },
      { name: "Authentication", status: "operational", responseTime: "95ms", errors: 0 },
    ],
    notes: [
      { id: "n1", admin: "Sarah K.", timestamp: "14:40", text: "Confirmed SMTP provider dashboard shows throttling. Checking if we can increase rate limit." },
      { id: "n2", admin: "Mike D.", timestamp: "15:02", text: "Backup relay tested and confirmed working. Switching over now." },
      { id: "n3", admin: "Sarah K.", timestamp: "15:15", text: "All queued emails delivered. Opened ticket with primary SMTP provider." },
    ],
    resolution: {
      rootCause: "Primary SMTP provider (SendGrid) applied rate limiting due to sudden volume spike from a scheduled job alert batch.",
      fix: "Switched outbound email routing to backup SMTP relay (Postmark). Queue workers resumed processing within 5 minutes.",
      preventive: "Implement email sending rate smoothing for batch jobs. Add automatic SMTP failover. Set up provider-level rate limit monitoring alerts.",
    },
    assignedAdmin: "Sarah K.",
    metricsLatency: [120, 125, 180, 320, 450, 380, 280, 190, 140, 125, 120, 118],
    metricsErrorRate: [0.2, 0.3, 1.2, 4.8, 8.2, 5.1, 2.3, 0.8, 0.4, 0.3, 0.2, 0.2],
    metricsRequests: [2800, 2900, 2700, 2200, 1800, 2100, 2500, 2700, 2800, 2850, 2900, 2847],
  },
  "inc-2": {
    id: "inc-2",
    title: "File storage latency spike",
    severity: "low",
    status: "monitoring",
    startedAt: "Mar 26, 2025 · 09:15 UTC",
    duration: "Ongoing",
    region: "Canada (ca-central-1)",
    description: "S3 bucket in ca-central-1 showing elevated latency for file uploads, affecting resume and document uploads.",
    affectedServiceNames: ["File Storage"],
    timeline: [
      { time: "09:15", title: "Latency alert triggered", description: "P95 latency exceeded 300ms threshold", type: "alert" },
      { time: "09:18", title: "On-call acknowledged", description: "Mike D. acknowledged the alert", type: "action" },
      { time: "09:22", title: "Confirmed elevated latency", description: "P95 latency at 340ms, normal baseline is 180ms", type: "info" },
      { time: "09:30", title: "External check", description: "AWS status page shows no reported issues in ca-central-1", type: "info" },
      { time: "09:45", title: "Monitoring continues", description: "Latency trending slightly downward, continuing to monitor", type: "info" },
    ],
    affectedServices: [
      { name: "File Storage", status: "degraded", responseTime: "340ms", errors: 3 },
      { name: "API", status: "operational", responseTime: "120ms", errors: 0 },
      { name: "Database", status: "operational", responseTime: "8ms", errors: 0 },
    ],
    notes: [
      { id: "n1", admin: "Mike D.", timestamp: "09:25", text: "No changes deployed recently. Checking if this correlates with increased upload volume." },
    ],
    resolution: null,
    assignedAdmin: "Mike D.",
    metricsLatency: [180, 190, 220, 280, 340, 330, 310, 320, 340, 330, 310, 300],
    metricsErrorRate: [0.1, 0.1, 0.2, 0.3, 0.5, 0.4, 0.3, 0.3, 0.4, 0.3, 0.2, 0.2],
    metricsRequests: [500, 520, 540, 530, 510, 490, 500, 520, 540, 530, 510, 500],
  },
  "inc-3": {
    id: "inc-3",
    title: "Database connection pool exhaustion",
    severity: "critical",
    status: "resolved",
    startedAt: "Mar 23, 2025 · 02:10 UTC",
    duration: "35 min",
    region: "Global",
    description: "Connection pool maxed out due to long-running analytics query, causing cascading API failures across all regions.",
    affectedServiceNames: ["Database", "API"],
    timeline: [
      { time: "02:10", title: "Connection pool critical", description: "Pool utilization hit 100% (100/100 connections)", type: "alert" },
      { time: "02:12", title: "API errors spiking", description: "Error rate jumped to 12%, users experiencing timeouts", type: "alert" },
      { time: "02:15", title: "PagerDuty escalation", description: "Sarah K. paged and acknowledged", type: "action" },
      { time: "02:22", title: "Root cause found", description: "Identified runaway analytics query consuming 47 connections", type: "info" },
      { time: "02:30", title: "Query terminated", description: "Killed long-running query, pool beginning to recover", type: "deploy" },
      { time: "02:38", title: "Pool stabilizing", description: "Connection count down to 62/100", type: "info" },
      { time: "02:45", title: "Incident resolved", description: "All connections restored, error rate back to baseline", type: "resolve" },
    ],
    affectedServices: [
      { name: "Database", status: "operational", responseTime: "8ms", errors: 0 },
      { name: "API", status: "operational", responseTime: "120ms", errors: 0 },
      { name: "Authentication", status: "operational", responseTime: "95ms", errors: 0 },
      { name: "Queue Workers", status: "operational", responseTime: "15ms", errors: 0 },
    ],
    notes: [
      { id: "n1", admin: "Sarah K.", timestamp: "02:20", text: "Checking pg_stat_activity for long-running queries." },
      { id: "n2", admin: "Sarah K.", timestamp: "02:25", text: "Found analytics query running for 4+ hours. Query originated from scheduled reporting cron." },
      { id: "n3", admin: "Mike D.", timestamp: "03:00", text: "Post-incident: we need query timeout limits and should move analytics to read replica." },
    ],
    resolution: {
      rootCause: "A scheduled analytics report query ran without timeout limits, consuming 47 database connections for over 4 hours.",
      fix: "Terminated the runaway query manually. Connection pool recovered within 15 minutes.",
      preventive: "Added statement_timeout of 300s for analytics role. Moved all analytics queries to read replica. Added connection pool utilization alerting at 80% threshold.",
    },
    assignedAdmin: "Sarah K.",
    metricsLatency: [8, 8, 12, 45, 890, 1200, 950, 420, 85, 15, 10, 8],
    metricsErrorRate: [0.1, 0.2, 0.5, 4.0, 12.0, 9.5, 5.2, 1.8, 0.5, 0.2, 0.1, 0.1],
    metricsRequests: [1200, 1250, 1100, 800, 400, 500, 750, 1000, 1150, 1200, 1250, 1200],
  },
};

// ── Helpers ──

const severityStyles: Record<string, string> = {
  low:
    "bg-slate-100 text-slate-600 border border-slate-200",
  medium:
    "bg-amber-500/10 text-amber-600 border border-amber-500/20",
  high:
    "bg-orange-500/10 text-orange-600 border border-orange-500/20",
  critical:
    "bg-rose-500/10 text-rose-600 border border-rose-500/20",
};

const statusStyles: Record<string, string> = {
  investigating:
    "bg-amber-500/10 text-amber-600 border border-amber-500/20",
  identified:
    "bg-blue-500/10 text-blue-600 border border-blue-500/20",
  monitoring:
    "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20",
  resolved:
    "bg-slate-100 text-slate-600 border border-slate-200",
};

const serviceStatusDot: Record<string, string> = {
  operational: "bg-emerald-500",
  degraded: "bg-amber-500",
  down: "bg-rose-500",
};

const timelineIcon: Record<string, React.ReactNode> = {
  alert: <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />,
  action: <Shield className="h-3.5 w-3.5 text-blue-600" />,
  deploy: <Zap className="h-3.5 w-3.5 text-indigo-600" />,
  info: <Radio className="h-3.5 w-3.5 text-slate-500" />,
  resolve: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />,
};

const timelineDot: Record<string, string> = {
  alert: "border-amber-500 bg-amber-500/15",
  action: "border-blue-500 bg-blue-500/10",
  deploy: "border-indigo-500 bg-indigo-500/10",
  info: "border-slate-300 bg-slate-100",
  resolve: "border-emerald-500 bg-emerald-500/15",
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{children}</h2>;
}

// ── Page ──

export default function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const incident = id ? incidentsData[id] : null;

  const [status, setStatus] = useState<IncidentStatus>(incident?.status ?? "investigating");
  const [notes, setNotes] = useState<Note[]>(incident?.notes ?? []);
  const [noteInput, setNoteInput] = useState("");
  const [resolution, setResolution] = useState(
    incident?.resolution ?? { rootCause: "", fix: "", preventive: "" }
  );
  const [showResolution, setShowResolution] = useState(status === "resolved");

  const isAlertCreated = id?.startsWith("inc-alert-");

  if (!incident) {
    return (
      <>
        <div className="p-8 text-center space-y-4">
          {isAlertCreated ? (
            <>
              <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="text-foreground font-medium">Incident created from alert</p>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                This incident was auto-created from a triggered alert rule. In production, it would be populated with alert context, affected services, and metrics data.
              </p>
              <div className="flex items-center justify-center gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => navigate("/alerts")}>
                  <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Alerts
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate("/admin/system-health")}>
                  System Health
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-muted-foreground">Incident not found.</p>
              <Button variant="ghost" onClick={() => navigate("/admin/system-health")}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to System Health
              </Button>
            </>
          )}
        </div>
      </>
    );
  }

  const handleResolve = () => {
    setStatus("resolved");
    setShowResolution(true);
    toast.success("Incident marked as resolved");
  };

  const handleReopen = () => {
    setStatus("investigating");
    setShowResolution(false);
    toast("Incident reopened", { description: "Status set to investigating" });
  };

  const handleEscalate = () => {
    toast("Incident escalated", { description: "On-call team has been notified" });
  };

  const handleAddNote = () => {
    if (!noteInput.trim()) return;
    const newNote: Note = {
      id: `n-${Date.now()}`,
      admin: "You",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      text: noteInput.trim(),
    };
    setNotes((prev) => [...prev, newNote]);
    setNoteInput("");
    toast.success("Note added");
  };

  return (
    <>
      <div className="space-y-8 p-6 md:p-8 max-w-5xl">
        {/* ── Header ── */}
        <div>
          <Button variant="outline" size="sm" className="mb-4 -ml-2 text-muted-foreground" onClick={() => navigate("/admin/system-health")}>
            <ArrowLeft className="h-4 w-4 mr-1.5" /> System Health
          </Button>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1.5">
              <h1 className="text-2xl font-bold tracking-tight">{incident.title}</h1>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={cn("capitalize text-xs", statusStyles[status])}>
                  {status}
                </Badge>
                <Badge variant="outline" className={cn("capitalize text-xs", severityStyles[incident.severity])}>
                  {incident.severity}
                </Badge>
                <span className="text-xs text-muted-foreground font-mono">{incident.id}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {status !== "resolved" ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="default" size="sm">
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Resolve
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Resolve this incident?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will mark the incident as resolved. You can add resolution notes afterward.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleResolve}>Resolve</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <Button variant="outline" size="sm" onClick={handleReopen}>
                  Reopen
                </Button>
              )}
              <Button variant="default" size="sm" onClick={handleEscalate}>
                <ArrowUpRight className="h-3.5 w-3.5 mr-1.5" /> Escalate
              </Button>
              <Button variant="default" size="sm" onClick={() => document.getElementById("note-input")?.focus()}>
                <MessageSquare className="h-3.5 w-3.5 mr-1.5" /> Add Note
              </Button>
            </div>
          </div>
        </div>

        <Separator />

        {/* ── Section 1: Summary ── */}
        <section className="space-y-3">
          <SectionTitle>Incident Summary</SectionTitle>
          <p className="text-sm text-foreground leading-relaxed max-w-2xl">{incident.description}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
            <div>
              <p className="text-xs text-muted-foreground">Start Time</p>
              <p className="text-sm font-medium mt-0.5 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                {incident.startedAt}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Duration</p>
              <p className="text-sm font-medium mt-0.5">{incident.duration}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Region</p>
              <p className="text-sm font-medium mt-0.5">{incident.region}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Assigned</p>
              <p className="text-sm font-medium mt-0.5">{incident.assignedAdmin}</p>
            </div>
          </div>
        </section>

        <Separator />

        {/* ── Section 2: Metrics Snapshot ── */}
        <section className="space-y-3">
          <SectionTitle>Metrics Snapshot</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: "API Latency", data: incident.metricsLatency, unit: "ms" },
              { label: "Error Rate", data: incident.metricsErrorRate, unit: "%" },
              { label: "Request Volume", data: incident.metricsRequests, unit: "rpm" },
            ].map((m) => (
              <div key={m.label} className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
                <div>
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                  <p className="text-lg font-semibold tracking-tight mt-0.5">
                    {m.data[m.data.length - 1]}
                    <span className="text-xs font-normal text-muted-foreground ml-1">{m.unit}</span>
                  </p>
                </div>
                <MiniChart data={m.data} className="opacity-60" />
              </div>
            ))}
          </div>
        </section>

        <Separator />

        {/* ── Section 3: Timeline ── */}
        <section className="space-y-3">
          <SectionTitle>Incident Timeline</SectionTitle>
          <div className="space-y-0">
            {incident.timeline.map((entry, i) => (
              <div key={i} className="flex gap-4 group">
                {/* Left: time */}
                <div className="w-14 shrink-0 text-right pt-3">
                  <span className="text-xs text-muted-foreground font-mono">{entry.time}</span>
                </div>

                {/* Center: dot + line */}
                <div className="relative flex flex-col items-center">
                  <div className={cn(
                    "h-7 w-7 rounded-full border-2 flex items-center justify-center shrink-0 mt-2.5 bg-card z-10",
                    timelineDot[entry.type]
                  )}>
                    {timelineIcon[entry.type]}
                  </div>
                  {i < incident.timeline.length - 1 && (
                    <div className="w-px flex-1 bg-border" />
                  )}
                </div>

                {/* Right: content */}
                <div className="pb-6 pt-2.5 min-w-0">
                  <p className="text-sm font-medium">{entry.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{entry.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <Separator />

        {/* ── Section 4: Affected Systems ── */}
        <section className="space-y-3">
          <SectionTitle>Affected Systems</SectionTitle>
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/50">
                  <TableHead>Service</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Response Time</TableHead>
                  <TableHead>Errors</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incident.affectedServices.map((svc) => (
                  <TableRow key={svc.name}>
                    <TableCell className="font-medium">{svc.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={cn("h-2 w-2 rounded-full", serviceStatusDot[svc.status])} />
                        <span className="text-sm capitalize">{svc.status}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{svc.responseTime}</TableCell>
                    <TableCell className="text-sm">
                      {svc.errors > 0 ? (
                        <span className="text-destructive font-medium">{svc.errors}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        <Separator />

        {/* ── Section 5: Internal Notes ── */}
        <section className="space-y-3">
          <SectionTitle>Internal Notes</SectionTitle>
          <div className="space-y-3">
            {notes.map((note) => (
              <div key={note.id} className="flex gap-3 text-sm">
                <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center shrink-0 text-xs font-semibold text-secondary-foreground">
                  {note.admin.charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{note.admin}</span>
                    <span className="text-xs text-muted-foreground">{note.timestamp}</span>
                  </div>
                  <p className="text-sm text-foreground mt-0.5 leading-relaxed">{note.text}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Add note input */}
          <div className="flex gap-2 pt-2">
            <Input
              id="note-input"
              placeholder="Add an internal note..."
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
              className="flex-1"
            />
            <Button size="sm" variant="default" onClick={handleAddNote} disabled={!noteInput.trim()}>
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </section>

        <Separator />

        {/* ── Section 6: Resolution ── */}
        <section className="space-y-3">
          <SectionTitle>Resolution</SectionTitle>
          {showResolution || status === "resolved" ? (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Root Cause</label>
                <Textarea
                  value={resolution.rootCause}
                  onChange={(e) => setResolution((r) => ({ ...r, rootCause: e.target.value }))}
                  placeholder="Describe the root cause..."
                  className="mt-1.5 min-h-[80px]"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Fix Applied</label>
                <Textarea
                  value={resolution.fix}
                  onChange={(e) => setResolution((r) => ({ ...r, fix: e.target.value }))}
                  placeholder="Describe the fix that was applied..."
                  className="mt-1.5 min-h-[80px]"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Preventive Measures</label>
                <Textarea
                  value={resolution.preventive}
                  onChange={(e) => setResolution((r) => ({ ...r, preventive: e.target.value }))}
                  placeholder="Describe preventive measures..."
                  className="mt-1.5 min-h-[80px]"
                />
              </div>
              <Button
                size="sm"
                onClick={() => toast.success("Resolution notes saved")}
                disabled={!resolution.rootCause.trim()}
              >
                Save Resolution
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Resolution notes will be available once the incident is resolved.
            </p>
          )}
        </section>

        <div className="h-8" />
      </div>
    </>
  );
}
