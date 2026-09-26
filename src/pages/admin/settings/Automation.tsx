import { useState } from "react";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AutomationTask } from "@/data/admin/automation/automation";
import { AutomationRow } from "@/components/adminDashboard/settings/automation/AutomationRow";
import { AutomationConfigPanel } from "@/components/adminDashboard/settings/automation/AutomationConfigPanel";
import { Separator } from "@/components/ui/separator";

const initialTasks: AutomationTask[] = [
  {
    id: "auto-expire",
    name: "Auto-expire Jobs",
    description: "Automatically close job postings past their expiry date",
    frequency: "Every hour",
    status: "active",
    enabled: true,
    lastRun: "12 min ago",
    lastRunResult: "success",
    nextRun: "In 48 min",
    parameters: { grace_period_days: "3" },
    logsUrl: "#",
  },
  {
    id: "job-alerts",
    name: "Job Alerts",
    description: "Send email notifications for matching new jobs",
    frequency: "Every 15 minutes",
    status: "active",
    enabled: true,
    lastRun: "3 min ago",
    lastRunResult: "success",
    nextRun: "In 12 min",
    parameters: { batch_size: "500", max_per_user: "10" },
    logsUrl: "#",
  },
  {
    id: "cleanup-users",
    name: "Cleanup Inactive Users",
    description: "Archive accounts with no activity in the retention window",
    frequency: "Weekly",
    status: "paused",
    enabled: false,
    lastRun: "7 days ago",
    lastRunResult: "success",
    nextRun: "—",
    parameters: { inactive_days: "365", dry_run: "true" },
    logsUrl: "#",
  },
  {
    id: "fraud-scan",
    name: "Fraud Scan",
    description: "Detect suspicious postings and flag for review",
    frequency: "Every 6 hours",
    status: "error",
    enabled: true,
    lastRun: "2 hr ago",
    lastRunResult: "error",
    nextRun: "In 4 hr",
    parameters: { sensitivity: "medium", auto_remove: "false" },
    logsUrl: "#",
  },
  {
    id: "backups",
    name: "Backups",
    description: "Full database and file storage backup to S3",
    frequency: "Daily",
    status: "active",
    enabled: true,
    lastRun: "6 hr ago",
    lastRunResult: "success",
    nextRun: "Tomorrow 02:00",
    parameters: { retention_days: "30", compression: "gzip" },
    logsUrl: "#",
  },
  {
    id: "feed-imports",
    name: "Feed Imports",
    description: "Import job postings from external XML/JSON feeds",
    frequency: "Every 12 hours",
    status: "active",
    enabled: true,
    lastRun: "4 hr ago",
    lastRunResult: "success",
    nextRun: "In 8 hr",
    parameters: { feed_count: "12", dedup: "true" },
    logsUrl: "#",
  },
  {
    id: "salary-compliance",
    name: "Salary Compliance Checks",
    description: "Validate postings meet provincial salary transparency rules",
    frequency: "Daily",
    status: "active",
    enabled: true,
    lastRun: "1 hr ago",
    lastRunResult: "success",
    nextRun: "Tomorrow 06:00",
    parameters: { provinces: "ON,BC,NS", flag_missing: "true" },
    logsUrl: "#",
  },
];

export default function AutomationPage() {
  const [tasks, setTasks] = useState<AutomationTask[]>(initialTasks);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = tasks.find((t) => t.id === selectedId) ?? null;

  const handleUpdate = (updated: AutomationTask) => {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

  return (
    <>
      <div className="space-y-6 p-6 md:p-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Automation</h1>
          <p className="text-muted-foreground mt-1">
            Manage background jobs and system automation
          </p>
        </div>

         <Separator className="mb-6" />

        {/* Tasks Table */}
        <div className="rounded-lg border border-border bg-card shadow-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/50">
                <TableHead>Task Name</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Run</TableHead>
                <TableHead>Next Run</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
                <AutomationRow
                  key={task.id}
                  task={task}
                  onConfigure={() => setSelectedId(task.id)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Configuration Slide-over */}
      <AutomationConfigPanel
        task={selected}
        open={!!selectedId}
        onOpenChange={(open) => !open && setSelectedId(null)}
        onUpdate={handleUpdate}
      />
    </>
  );
}
