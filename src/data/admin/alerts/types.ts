export type AlertSeverity = "low" | "medium" | "high" | "critical";
export type AlertStatus = "active" | "disabled";
export type ChannelType = "slack" | "email" | "webhook";
export type ChannelStatus = "connected" | "disconnected" | "error";

export type MetricType =
  | "api_error_rate"
  | "api_latency"
  | "job_failures"
  | "queue_size"
  | "login_failures"
  | "custom";

export type OperatorType = "greater_than" | "less_than" | "equals";

export interface EscalationStep {
  id: string;
  delayMinutes: number;
  channels: ChannelType[];
  notifyMessage?: string;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  metric: MetricType;
  operator: OperatorType;
  threshold: number;
  timeWindow: string;
  severity: AlertSeverity;
  channels: ChannelType[];
  status: AlertStatus;
  cooldownMinutes: number;
  retrigger: boolean;
  autoResolve: boolean;
  escalationEnabled: boolean;
  escalationSteps: EscalationStep[];
  lastTriggered: string | null;
  createdAt: string;
}

export interface NotificationChannel {
  id: string;
  name: string;
  type: ChannelType;
  status: ChannelStatus;
  lastUsed: string | null;
  config: Record<string, string>;
}

export interface AlertHistoryEntry {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: AlertSeverity;
  status: "triggered" | "resolved" | "acknowledged";
  triggeredAt: string;
  resolvedAt: string | null;
  message: string;
  incidentId?: string;
}

export const METRIC_LABELS: Record<MetricType, string> = {
  api_error_rate: "API Error Rate",
  api_latency: "API Latency",
  job_failures: "Job Failures",
  queue_size: "Queue Size",
  login_failures: "Login Failures",
  custom: "Custom Metric",
};

export const OPERATOR_LABELS: Record<OperatorType, string> = {
  greater_than: "Greater than",
  less_than: "Less than",
  equals: "Equals",
};

export const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  critical: "bg-destructive/10 text-destructive",
};

export type SuppressionStatus = "scheduled" | "active" | "expired";

export interface SuppressionWindow {
  id: string;
  name: string;
  description: string;
  startTime: string;
  endTime: string;
  ruleIds: string[]; // empty = all rules
  status: SuppressionStatus;
  recurring: boolean;
  recurrencePattern?: string;
  createdBy: string;
  createdAt: string;
}
