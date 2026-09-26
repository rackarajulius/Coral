import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { Incident } from "@/data/admin/system-health/system-health";

const severityMap: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-status-warning/15 text-status-warning-foreground border-status-warning/30",
  high: "bg-status-warning/25 text-status-warning-foreground border-status-warning/50",
  critical: "bg-destructive/15 text-destructive border-destructive/30",
};

const statusMap: Record<string, string> = {
  investigating: "bg-status-warning/15 text-status-warning-foreground",
  identified: "bg-status-warning/15 text-status-warning-foreground",
  monitoring: "bg-status-operational/15 text-status-operational-foreground",
  resolved: "bg-status-operational/15 text-status-operational-foreground",
};

interface IncidentPanelProps {
  incident: Incident | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function IncidentPanel({ incident, open, onOpenChange }: IncidentPanelProps) {
  if (!incident) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-lg">{incident.title}</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Meta */}
          <div className="flex flex-wrap gap-2">
            <Badge className={severityMap[incident.severity]} variant="outline">
              {incident.severity}
            </Badge>
            <Badge className={statusMap[incident.status]} variant="outline">
              {incident.status}
            </Badge>
          </div>

          {/* Description */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Description</p>
            <p className="text-sm text-foreground leading-relaxed">{incident.description}</p>
          </div>

          <Separator />

          {/* Affected Systems */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Affected Systems</p>
            <div className="flex flex-wrap gap-1.5">
              {incident.affectedSystems.map((s) => (
                <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
              ))}
            </div>
          </div>

          {/* Details */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Started</p>
              <p className="font-medium">{incident.startedAt}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Resolved</p>
              <p className="font-medium">{incident.resolvedAt ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Duration</p>
              <p className="font-medium">{incident.duration}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Assigned</p>
              <p className="font-medium">{incident.assignedAdmin}</p>
            </div>
          </div>

          <Separator />

          {/* Timeline */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Timeline</p>
            <div className="space-y-3">
              {incident.timeline.map((entry, i) => (
                <div key={i} className="flex gap-3 text-sm">
                  <span className="text-muted-foreground whitespace-nowrap text-xs pt-0.5 min-w-[60px]">{entry.time}</span>
                  <div className="relative pl-4 border-l border-border">
                    <span className="absolute left-[-3px] top-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                    <p>{entry.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Resolution Notes */}
          {incident.resolutionNotes && (
            <>
              <Separator />
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Resolution Notes</p>
                <p className="text-sm leading-relaxed">{incident.resolutionNotes}</p>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
