import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableRow, TableCell } from "@/components/ui/table";
import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import type { AutomationTask } from "@/data/admin/automation/automation";

const resultIcons: Record<string, React.ReactNode> = {
  success: <CheckCircle2 className="h-3.5 w-3.5 text-status-connected" />,
  error: <AlertCircle className="h-3.5 w-3.5 text-destructive" />,
  pending: <Clock className="h-3.5 w-3.5 text-muted-foreground" />,
};

interface AutomationRowProps {
  task: AutomationTask;
  onConfigure: () => void;
}

export function AutomationRow({ task, onConfigure }: AutomationRowProps) {
  return (
    <TableRow
      className="cursor-pointer hover:bg-secondary/30 transition-colors"
      onClick={onConfigure}
    >
      <TableCell>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{task.name}</p>
          <p className="text-xs text-muted-foreground truncate">{task.description}</p>
        </div>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">{task.frequency}</TableCell>
      <TableCell>
        <Badge
          variant={
            task.status === "active"
              ? "connected"
              : task.status === "error"
              ? "destructive"
              : "disconnected"
          }
        >
          {task.status === "active" ? "Active" : task.status === "error" ? "Error" : "Paused"}
        </Badge>
      </TableCell>
      <TableCell>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          {resultIcons[task.lastRunResult]}
          {task.lastRun}
        </span>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">{task.nextRun}</TableCell>
      <TableCell className="text-right">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={(e) => {
            e.stopPropagation();
            onConfigure();
          }}
        >
          Configure
        </Button>
      </TableCell>
    </TableRow>
  );
}
