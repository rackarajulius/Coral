export type ServiceStatus = "operational" | "degraded" | "down";
export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type IncidentStatus = "investigating" | "identified" | "monitoring" | "resolved";
export type JobStatus = "running" | "completed" | "failed" | "scheduled";
export type QueueStatus = "healthy" | "degraded" | "backlogged";

export interface SystemService {
  name: string;
  status: ServiceStatus;
  latency: string;
}

export interface PerformanceMetric {
  label: string;
  value: string;
  unit: string;
  change?: string;
  changeDirection?: "up" | "down" | "neutral";
  data: number[];
}

export interface Incident {
  id: string;
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  startedAt: string;
  resolvedAt: string | null;
  duration: string;
  description: string;
  affectedSystems: string[];
  timeline: { time: string; message: string }[];
  resolutionNotes: string | null;
  assignedAdmin: string;
}

export interface BackgroundJob {
  id: string;
  name: string;
  status: JobStatus;
  lastRun: string;
  nextRun: string;
  duration: string;
  result: "success" | "error" | "pending";
}

export interface QueueInfo {
  name: string;
  pending: number;
  processingRate: string;
  failures: number;
  status: QueueStatus;
}
