import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import type { AuditLogEntry } from "@/data/admin/audit-logs/types";

interface AuditLogDetailPanelProps {
  log: AuditLogEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuditLogDetailPanel({ log, open, onOpenChange }: AuditLogDetailPanelProps) {
  if (!log) return null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-base font-semibold">Log Details</SheetTitle>
        </SheetHeader>

        {/* Overview */}
        <div className="space-y-4">
          <section className="space-y-3">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Overview</h3>
            <div className="space-y-2 text-sm">
              <Row label="Admin" value={log.adminUser} />
              <Row label="Action" value={log.action} />
              <Row label="Timestamp" value={log.timestamp} />
              <Row label="IP Address" value={log.ipAddress} />
              {log.device && <Row label="Device" value={log.device} />}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge
                  variant="secondary"
                  className={log.status === "Success"
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                    : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400"
                  }
                >
                  {log.status}
                </Badge>
              </div>
            </div>
          </section>

          <Separator />

          {/* Entity Info */}
          <section className="space-y-3">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Entity</h3>
            <div className="space-y-2 text-sm">
              <Row label="Type" value={log.entityType} />
              <Row label="ID" value={log.entityId} mono />
              <Row label="Name" value={log.entityName} />
            </div>
          </section>

          <Separator />

          {/* Change Diff */}
          {(log.before || log.after) && (
            <>
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Change Diff</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => copyToClipboard(JSON.stringify({ before: log.before, after: log.after }, null, 2))}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-xs font-medium text-muted-foreground mb-1 block">Before</span>
                    <pre className="rounded-md bg-muted p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
                      {JSON.stringify(log.before ?? {}, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted-foreground mb-1 block">After</span>
                    <pre className="rounded-md bg-muted p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
                      {JSON.stringify(log.after ?? {}, null, 2)}
                    </pre>
                  </div>
                </div>
              </section>
              <Separator />
            </>
          )}

          {/* Metadata */}
          <section className="space-y-3">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Metadata</h3>
            <div className="space-y-2 text-sm">
              <Row label="Request ID" value={log.requestId} mono />
              <Row label="Source" value={log.source} />
              {log.region && <Row label="Region" value={log.region} />}
            </div>
          </section>

          {/* Related Actions */}
          {log.relatedActions && log.relatedActions.length > 0 && (
            <>
              <Separator />
              <section className="space-y-3">
                <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Related Actions</h3>
                <div className="space-y-2">
                  {log.relatedActions.map((ra) => (
                    <div key={ra.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{ra.action}</span>
                        <span className="text-muted-foreground">{ra.entityName}</span>
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">{ra.timestamp}</span>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-xs" : ""}>{value}</span>
    </div>
  );
}
