import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Bell,
  Plus,
  Settings2,
  Search,
  Trash2,
  Pencil,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  XCircle,
  Clock,
  RefreshCw,
  ShieldOff,
  CalendarClock,
  Repeat,
  PauseCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AlertRulePanel } from "@/components/adminDashboard/alerts/AlertRulePanel";
import { ChannelPanel } from "@/components/adminDashboard/alerts/ChannelPanel";
import { SuppressionWindowPanel } from "@/components/adminDashboard/alerts/SuppressionWindowPanel";
import type {
  AlertRule,
  AlertSeverity,
  NotificationChannel,
  AlertHistoryEntry,
  ChannelType,
  EscalationStep,
  SuppressionWindow,
  METRIC_LABELS,
  OPERATOR_LABELS,
  SEVERITY_COLORS,
} from "@/data/admin/alerts/types";

const SEVERITY_STYLES: Record<AlertSeverity, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  critical: "bg-destructive/10 text-destructive",
};

const METRIC_DISPLAY: Record<string, string> = {
  api_error_rate: "API Error Rate",
  api_latency: "API Latency",
  job_failures: "Job Failures",
  queue_size: "Queue Size",
  login_failures: "Login Failures",
  custom: "Custom Metric",
};

const OPERATOR_DISPLAY: Record<string, string> = {
  greater_than: ">",
  less_than: "<",
  equals: "=",
};

// Sample data
const initialRules: AlertRule[] = [
  {
    id: "1",
    name: "API Error Spike",
    description: "Triggers when API errors exceed threshold",
    metric: "api_error_rate",
    operator: "greater_than",
    threshold: 5,
    timeWindow: "2 minutes",
    severity: "critical",
    channels: ["slack", "email"],
    status: "active",
    cooldownMinutes: 10,
    retrigger: true,
    autoResolve: true,
    escalationEnabled: true,
    escalationSteps: [
      { id: "e1", delayMinutes: 10, channels: ["webhook"], notifyMessage: "URGENT: API errors unresolved for 10+ min" },
      { id: "e2", delayMinutes: 30, channels: ["slack", "email", "webhook"], notifyMessage: "CRITICAL: Escalating to all channels" },
    ],
    lastTriggered: "2 mins ago",
    createdAt: "2026-03-15T10:00:00Z",
  },
  {
    id: "2",
    name: "High API Latency",
    description: "Alert when response times are slow",
    metric: "api_latency",
    operator: "greater_than",
    threshold: 2000,
    timeWindow: "5 minutes",
    severity: "high",
    channels: ["slack"],
    status: "active",
    cooldownMinutes: 15,
    retrigger: true,
    autoResolve: true,
    escalationEnabled: true,
    escalationSteps: [
      { id: "e3", delayMinutes: 15, channels: ["email"], notifyMessage: "Latency still elevated" },
    ],
    lastTriggered: "1 hour ago",
    createdAt: "2026-03-20T10:00:00Z",
  },
  {
    id: "3",
    name: "Job Queue Overflow",
    description: "Queue size exceeding capacity",
    metric: "queue_size",
    operator: "greater_than",
    threshold: 500,
    timeWindow: "5 minutes",
    severity: "medium",
    channels: ["email"],
    status: "active",
    cooldownMinutes: 30,
    retrigger: false,
    autoResolve: false,
    escalationEnabled: false,
    escalationSteps: [],
    lastTriggered: "3 days ago",
    createdAt: "2026-04-01T10:00:00Z",
  },
  {
    id: "4",
    name: "Login Brute Force",
    description: "Detect brute force login attempts",
    metric: "login_failures",
    operator: "greater_than",
    threshold: 20,
    timeWindow: "1 minute",
    severity: "critical",
    channels: ["slack", "email", "webhook"],
    status: "active",
    cooldownMinutes: 5,
    retrigger: true,
    autoResolve: false,
    escalationEnabled: true,
    escalationSteps: [
      { id: "e4", delayMinutes: 5, channels: ["webhook"], notifyMessage: "Brute force attack ongoing" },
      { id: "e5", delayMinutes: 15, channels: ["slack", "email", "webhook"], notifyMessage: "CRITICAL: Login attack unresolved" },
    ],
    lastTriggered: null,
    createdAt: "2026-04-05T10:00:00Z",
  },
  {
    id: "5",
    name: "Nightly Job Failures",
    description: "Monitor overnight batch processing",
    metric: "job_failures",
    operator: "greater_than",
    threshold: 3,
    timeWindow: "10 minutes",
    severity: "low",
    channels: ["email"],
    status: "disabled",
    cooldownMinutes: 60,
    retrigger: false,
    autoResolve: true,
    escalationEnabled: false,
    escalationSteps: [],
    lastTriggered: "1 week ago",
    createdAt: "2026-03-10T10:00:00Z",
  },
];

const initialChannels: NotificationChannel[] = [
  { id: "c1", name: "#ops-alerts", type: "slack", status: "connected", lastUsed: "2 mins ago", config: { webhookUrl: "https://hooks.slack.com/services/T00/B00/xxx", slackChannel: "#ops-alerts" } },
  { id: "c2", name: "Ops Team Email", type: "email", status: "connected", lastUsed: "1 hour ago", config: { emails: "ops@company.com, admin@company.com" } },
  { id: "c3", name: "PagerDuty Webhook", type: "webhook", status: "connected", lastUsed: "3 days ago", config: { endpointUrl: "https://events.pagerduty.com/v2/enqueue", headers: '{"Authorization": "Bearer pd-key"}' } },
  { id: "c4", name: "#eng-alerts", type: "slack", status: "error", lastUsed: "1 week ago", config: { webhookUrl: "https://hooks.slack.com/services/T00/B00/yyy", slackChannel: "#eng-alerts" } },
];

const initialHistory: AlertHistoryEntry[] = [
  { id: "h1", ruleId: "1", ruleName: "API Error Spike", severity: "critical", status: "resolved", triggeredAt: "2026-04-10 14:30", resolvedAt: "2026-04-10 14:45", message: "Error rate reached 8.2% over 2 minutes", incidentId: "inc-3" },
  { id: "h2", ruleId: "2", ruleName: "High API Latency", severity: "high", status: "resolved", triggeredAt: "2026-04-10 13:15", resolvedAt: "2026-04-10 13:22", message: "P99 latency hit 3200ms", incidentId: "inc-1" },
  { id: "h3", ruleId: "1", ruleName: "API Error Spike", severity: "critical", status: "triggered", triggeredAt: "2026-04-10 14:28", resolvedAt: null, message: "Error rate spiking at 6.1%", incidentId: "inc-auto-h3" },
  { id: "h4", ruleId: "3", ruleName: "Job Queue Overflow", severity: "medium", status: "acknowledged", triggeredAt: "2026-04-07 09:00", resolvedAt: null, message: "Queue depth reached 612" },
  { id: "h5", ruleId: "4", ruleName: "Login Brute Force", severity: "critical", status: "resolved", triggeredAt: "2026-04-05 22:10", resolvedAt: "2026-04-05 22:12", message: "47 failed login attempts from 185.x.x.x", incidentId: "inc-auto-h5" },
];

const initialSuppressions: SuppressionWindow[] = [
  {
    id: "sw1",
    name: "Weekly DB Maintenance",
    description: "Suppress alerts during scheduled database maintenance every Sunday",
    startTime: "2026-04-12T02:00",
    endTime: "2026-04-12T04:00",
    ruleIds: [],
    status: "scheduled",
    recurring: true,
    recurrencePattern: "weekly",
    createdBy: "Sarah K.",
    createdAt: "2026-03-01T10:00:00Z",
  },
  {
    id: "sw2",
    name: "API Deploy Window",
    description: "Mute API alerts during v2.5 rollout",
    startTime: "2026-04-13T10:00",
    endTime: "2026-04-13T12:00",
    ruleIds: ["1", "2"],
    status: "active",
    recurring: false,
    createdBy: "Admin",
    createdAt: "2026-04-12T16:00:00Z",
  },
  {
    id: "sw3",
    name: "Infrastructure Migration",
    description: "Full alert suppression during cloud migration",
    startTime: "2026-04-01T00:00",
    endTime: "2026-04-01T06:00",
    ruleIds: [],
    status: "expired",
    recurring: false,
    createdBy: "DevOps",
    createdAt: "2026-03-28T10:00:00Z",
  },
];

export default function AlertsPage() {
  const navigate = useNavigate();
  const [rules, setRules] = useState<AlertRule[]>(initialRules);
  const [channels, setChannels] = useState<NotificationChannel[]>(initialChannels);
  const [history, setHistory] = useState<AlertHistoryEntry[]>(initialHistory);
  const [suppressions, setSuppressions] = useState<SuppressionWindow[]>(initialSuppressions);

  const [rulePanel, setRulePanel] = useState(false);
  const [editRule, setEditRule] = useState<AlertRule | null>(null);
  const [channelPanel, setChannelPanel] = useState(false);
  const [editChannel, setEditChannel] = useState<NotificationChannel | null>(null);
  const [suppressionPanel, setSuppressionPanel] = useState(false);
  const [editSuppression, setEditSuppression] = useState<SuppressionWindow | null>(null);

  const [search, setSearch] = useState("");
  const [deleteDialog, setDeleteDialog] = useState<{ type: "rule" | "channel" | "suppression"; id: string } | null>(null);
  const [severityFilter, setSeverityFilter] = useState("all");

  const toggleRuleStatus = (id: string) => {
    setRules((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, status: r.status === "active" ? "disabled" : "active" } : r
      )
    );
    toast.success("Rule status updated");
  };

  const handleSaveRule = (rule: AlertRule) => {
    setRules((prev) => {
      const idx = prev.findIndex((r) => r.id === rule.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = rule;
        return copy;
      }
      return [...prev, rule];
    });
  };

  const handleSaveChannel = (channel: NotificationChannel) => {
    setChannels((prev) => {
      const idx = prev.findIndex((c) => c.id === channel.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = channel;
        return copy;
      }
      return [...prev, channel];
    });
  };

  const handleSaveSuppression = (sw: SuppressionWindow) => {
    setSuppressions((prev) => {
      const idx = prev.findIndex((s) => s.id === sw.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = sw;
        return copy;
      }
      return [...prev, sw];
    });
  };

  const isRuleSuppressed = (ruleId: string): boolean => {
    return suppressions.some(
      (sw) =>
        sw.status === "active" &&
        (sw.ruleIds.length === 0 || sw.ruleIds.includes(ruleId))
    );
  };

  const handleDelete = () => {
    if (!deleteDialog) return;
    if (deleteDialog.type === "rule") {
      setRules((prev) => prev.filter((r) => r.id !== deleteDialog.id));
      toast.success("Alert rule deleted");
    } else if (deleteDialog.type === "channel") {
      setChannels((prev) => prev.filter((c) => c.id !== deleteDialog.id));
      toast.success("Channel removed");
    } else {
      setSuppressions((prev) => prev.filter((s) => s.id !== deleteDialog.id));
      toast.success("Suppression window deleted");
    }
    setDeleteDialog(null);
  };

  const autoCreateIncident = (entry: AlertHistoryEntry): AlertHistoryEntry => {
    if (entry.severity === "critical" && !entry.incidentId) {
      const incidentId = `inc-auto-${entry.id}`;
      toast.info("Auto-incident created", {
        description: `Critical alert "${entry.ruleName}" triggered automatic incident creation`,
        action: {
          label: "View Incident",
          onClick: () => navigate(`/system-health/incidents/${incidentId}`),
        },
      });
      return { ...entry, incidentId };
    }
    return entry;
  };

  const handleCreateIncident = (entry: AlertHistoryEntry) => {
    const incidentId = `inc-alert-${entry.id}`;
    setHistory((prev) =>
      prev.map((h) => (h.id === entry.id ? { ...h, incidentId } : h))
    );
    toast.success("Incident created from alert", {
      description: `${entry.ruleName} — navigating to incident`,
      action: {
        label: "View",
        onClick: () => navigate(`/system-health/incidents/${incidentId}`),
      },
    });
    navigate(`/system-health/incidents/${incidentId}`);
  };

  const simulateAlert = () => {
    const activeRules = rules.filter((r) => r.status === "active");
    if (activeRules.length === 0) {
      toast.error("No active rules to trigger");
      return;
    }
    const rule = activeRules[Math.floor(Math.random() * activeRules.length)];

    // Check suppression
    if (isRuleSuppressed(rule.id)) {
      toast.info(`Alert suppressed: ${rule.name}`, {
        description: "This rule is muted by an active suppression window",
        icon: <ShieldOff className="h-4 w-4" />,
      });
      return;
    }
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const newEntry: AlertHistoryEntry = {
      id: `h-sim-${Date.now()}`,
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      status: "triggered",
      triggeredAt: timestamp,
      resolvedAt: null,
      message: `Simulated: ${METRIC_DISPLAY[rule.metric]} ${OPERATOR_DISPLAY[rule.operator]} ${rule.threshold}`,
    };

    const processed = autoCreateIncident(newEntry);

    setHistory((prev) => [processed, ...prev]);
    setRules((prev) =>
      prev.map((r) => (r.id === rule.id ? { ...r, lastTriggered: "Just now" } : r))
    );

    if (processed.severity === "critical") {
      toast.warning(`Critical alert triggered: ${rule.name}`, {
        description: "Incident auto-created due to critical severity",
      });
    } else {
      toast.success(`Alert triggered: ${rule.name}`, {
        description: `Severity: ${rule.severity}`,
      });
    }

    // Simulate escalation chain
    if (rule.escalationEnabled && rule.escalationSteps.length > 0) {
      rule.escalationSteps.forEach((step, idx) => {
        setTimeout(() => {
          toast.info(`Escalation Step ${idx + 1} triggered`, {
            description: `${rule.name} — notifying ${step.channels.map((c) => c.charAt(0).toUpperCase() + c.slice(1)).join(", ")} after ${step.delayMinutes}m${step.notifyMessage ? `: ${step.notifyMessage}` : ""}`,
          });
        }, (idx + 1) * 2000); // Simulate with 2s intervals
      });
    }
  };

  const filteredRules = rules.filter((r) => {
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (severityFilter !== "all" && r.severity !== severityFilter) return false;
    return true;
  });

  const channelLabel = (types: ChannelType[]) =>
    types.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(", ");

  const conditionText = (r: AlertRule) =>
    `${METRIC_DISPLAY[r.metric]} ${OPERATOR_DISPLAY[r.operator]} ${r.threshold} for ${r.timeWindow}`;

  return (
    <>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">Alerts & Notifications</h1>
            <p className="text-sm text-muted-foreground mt-1">Configure system alerts and notification channels</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-full"
              onClick={() => { setEditChannel(null); setChannelPanel(true); }}
            >
              <Settings2 className="h-3.5 w-3.5" />
              Manage Channels
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-full"
              onClick={simulateAlert}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Simulate Alert
            </Button>
            <Button
              size="sm"
              className="gap-1.5 rounded-full"
              onClick={() => { setEditRule(null); setRulePanel(true); }}
            >
              <Plus className="h-3.5 w-3.5" />
              Create Alert Rule
            </Button>
          </div>
        </div>

        <Tabs defaultValue="rules" className="space-y-4">
          <TabsList>
            <TabsTrigger value="rules" className="gap-1.5"><Bell className="h-3.5 w-3.5" />Alert Rules</TabsTrigger>
            <TabsTrigger value="channels" className="gap-1.5"><Settings2 className="h-3.5 w-3.5" />Channels</TabsTrigger>
            <TabsTrigger value="suppressions" className="gap-1.5"><ShieldOff className="h-3.5 w-3.5" />Suppressions</TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5"><Clock className="h-3.5 w-3.5" />History</TabsTrigger>
          </TabsList>

          {/* ALERT RULES TAB */}
          <TabsContent value="rules" className="space-y-4">
            {/* Filter bar */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search rules…"
                  className="pl-9"
                />
              </div>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Severity" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            <div className="border border-border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Rule Name</TableHead>
                    <TableHead className="hidden md:table-cell">Condition</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead className="hidden lg:table-cell">Channels</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Last Triggered</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRules.map((rule) => (
                    <TableRow
                      key={rule.id}
                      className="cursor-pointer hover:bg-muted/30"
                      onClick={() => { setEditRule(rule); setRulePanel(true); }}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm text-foreground">{rule.name}</p>
                          <p className="text-xs text-muted-foreground md:hidden mt-0.5">{conditionText(rule)}</p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-xs text-muted-foreground font-mono">{conditionText(rule)}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="secondary" className={SEVERITY_STYLES[rule.severity]}>
                            {rule.severity}
                          </Badge>
                          {rule.severity === "critical" && rule.status === "active" && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground border-dashed">
                              auto-incident
                            </Badge>
                          )}
                          {rule.escalationEnabled && rule.status === "active" && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground border-dashed">
                              {rule.escalationSteps.length}-step escalation
                            </Badge>
                          )}
                          {isRuleSuppressed(rule.id) && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400 gap-0.5">
                              <PauseCircle className="h-2.5 w-2.5" />
                              muted
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span className="text-sm text-muted-foreground">{channelLabel(rule.channels)}</span>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Switch
                          checked={rule.status === "active"}
                          onCheckedChange={() => toggleRuleStatus(rule.id)}
                        />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-sm text-muted-foreground">{rule.lastTriggered || "Never"}</span>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => { setEditRule(rule); setRulePanel(true); }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteDialog({ type: "rule", id: rule.id })}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredRules.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                        No alert rules found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* CHANNELS TAB */}
          <TabsContent value="channels" className="space-y-4">
            <div className="flex justify-end">
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => { setEditChannel(null); setChannelPanel(true); }}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Channel
              </Button>
            </div>
            <div className="border border-border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Channel Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Last Used</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {channels.map((ch) => (
                    <TableRow
                      key={ch.id}
                      className="cursor-pointer hover:bg-muted/30"
                      onClick={() => { setEditChannel(ch); setChannelPanel(true); }}
                    >
                      <TableCell className="font-medium text-sm">{ch.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{ch.type}</Badge>
                      </TableCell>
                      <TableCell>
                        {ch.status === "connected" && (
                          <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800 gap-1">
                            <CheckCircle2 className="h-3 w-3" />Connected
                          </Badge>
                        )}
                        {ch.status === "error" && (
                          <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/10 gap-1">
                            <XCircle className="h-3 w-3" />Error
                          </Badge>
                        )}
                        {ch.status === "disconnected" && (
                          <Badge variant="outline" className="text-muted-foreground gap-1">Disconnected</Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{ch.lastUsed || "Never"}</TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditChannel(ch); setChannelPanel(true); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteDialog({ type: "channel", id: ch.id })}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* SUPPRESSIONS TAB */}
          <TabsContent value="suppressions" className="space-y-4">
            <div className="flex justify-end">
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => { setEditSuppression(null); setSuppressionPanel(true); }}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Suppression Window
              </Button>
            </div>

            {/* Active suppression banner */}
            {suppressions.some((s) => s.status === "active") && (
              <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 px-4 py-3">
                <ShieldOff className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  <span className="font-medium">{suppressions.filter((s) => s.status === "active").length} active suppression window(s)</span>
                  {" — "}some alerts may be muted right now.
                </p>
              </div>
            )}

            <div className="border border-border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Window Name</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Created By</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppressions.map((sw) => (
                    <TableRow
                      key={sw.id}
                      className="cursor-pointer hover:bg-muted/30"
                      onClick={() => { setEditSuppression(sw); setSuppressionPanel(true); }}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm text-foreground">{sw.name}</p>
                          {sw.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 max-w-xs truncate">{sw.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-mono text-muted-foreground space-y-0.5">
                          <p>{new Date(sw.startTime).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                          <p>→ {new Date(sw.endTime).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {sw.ruleIds.length === 0
                            ? "All rules"
                            : `${sw.ruleIds.length} rule(s)`}
                        </span>
                      </TableCell>
                      <TableCell>
                        {sw.status === "active" && (
                          <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400 gap-1">
                            <PauseCircle className="h-3 w-3" />Active
                          </Badge>
                        )}
                        {sw.status === "scheduled" && (
                          <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 gap-1">
                            <CalendarClock className="h-3 w-3" />Scheduled
                          </Badge>
                        )}
                        {sw.status === "expired" && (
                          <Badge variant="outline" className="text-muted-foreground gap-1">Expired</Badge>
                        )}
                        {sw.recurring && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground border-dashed ml-1 gap-0.5">
                            <Repeat className="h-2.5 w-2.5" />
                            {sw.recurrencePattern}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{sw.createdBy}</TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditSuppression(sw); setSuppressionPanel(true); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteDialog({ type: "suppression", id: sw.id })}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {suppressions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                        No suppression windows configured.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <div className="border border-border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Rule</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Message</TableHead>
                    <TableHead className="hidden md:table-cell">Resolved At</TableHead>
                    <TableHead className="text-right">Incident</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="text-sm font-mono text-muted-foreground">{h.triggeredAt}</TableCell>
                      <TableCell className="text-sm font-medium">{h.ruleName}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={SEVERITY_STYLES[h.severity]}>{h.severity}</Badge>
                      </TableCell>
                      <TableCell>
                        {h.status === "triggered" && <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/10">Triggered</Badge>}
                        {h.status === "resolved" && <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800">Resolved</Badge>}
                        {h.status === "acknowledged" && <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800">Acknowledged</Badge>}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-xs truncate">{h.message}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{h.resolvedAt || "—"}</TableCell>
                      <TableCell className="text-right">
                        {h.incidentId ? (
                          <div className="flex items-center justify-end gap-1.5">
                            {h.incidentId.startsWith("inc-auto-") && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground border-dashed">
                                auto
                              </Badge>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1.5 text-xs"
                              onClick={() => navigate(`/admin/system-health/incidents/${h.incidentId}`)}
                            >
                              <ExternalLink className="h-3 w-3" />
                              View Incident
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-xs"
                            onClick={() => handleCreateIncident(h)}
                          >
                            <AlertTriangle className="h-3 w-3" />
                            Create Incident
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Panels */}
      <AlertRulePanel
        open={rulePanel}
        onOpenChange={setRulePanel}
        rule={editRule}
        onSave={handleSaveRule}
      />
      <ChannelPanel
        open={channelPanel}
        onOpenChange={setChannelPanel}
        channel={editChannel}
        onSave={handleSaveChannel}
      />

      <SuppressionWindowPanel
        open={suppressionPanel}
        onOpenChange={setSuppressionPanel}
        window={editSuppression}
        rules={rules}
        onSave={handleSaveSuppression}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteDialog?.type === "rule" ? "Alert Rule" : deleteDialog?.type === "channel" ? "Channel" : "Suppression Window"}?
            </AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
