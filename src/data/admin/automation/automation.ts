export interface AutomationTask {
  id: string;
  name: string;
  description: string;
  frequency: string;
  status: "active" | "paused" | "error";
  enabled: boolean;
  lastRun: string;
  lastRunResult: "success" | "error" | "pending";
  nextRun: string;
  parameters: Record<string, string>;
  logsUrl: string;
}
