import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Download, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { AuditLogEntry, ActionType, EntityType, LogStatus } from "@/data/admin/audit-logs/types";
import { AuditLogDetailPanel } from "@/components/adminDashboard/audit-logs/AuditLogDetailPanel";
import { AdminPagination } from "@/components/adminDashboard/AdminPagination";
import { useAuditLogs } from "@/hooks/admin/useAdminAuditLogs";
import { useAuditRetention, useUpdateAuditRetention } from "@/hooks/admin/useAuditRetention";

const actionTypes: ActionType[] = ["Create", "Update", "Delete", "Approve", "Reject", "Login", "Export", "Settings Change"];
const entityTypes: EntityType[] = ["Job", "Employer", "Jobseeker", "Application", "Verification", "Settings", "System"];
const statusOptions: LogStatus[] = ["Success", "Failed"];

export default function AuditLogsPage() {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const { data, isLoading, isFetching, refetch } = useAuditLogs({
    page,
    limit,
    search,
    action: actionFilter,
    entityType: entityFilter,
    status: statusFilter,
  });

  const logs = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const totalPages = data?.meta?.totalPages ?? 1;

  const hasFilters = !!search || actionFilter !== "all" || entityFilter !== "all" || statusFilter !== "all";

  const clearFilters = () => {
    setSearch("");
    setActionFilter("all");
    setEntityFilter("all");
    setStatusFilter("all");
    setPage(1);
  };

  const handleExport = () => {
    if (logs.length === 0) {
      toast.error("No logs on this page to export");
      return;
    }
    const csv = [
      ["Timestamp", "Admin", "Action", "Entity Type", "Entity", "Summary", "Status"].join(","),
      ...logs.map((l) =>
        [l.timestamp, l.adminUser, l.action, l.entityType, `"${l.entityName} (${l.entityId})"`, `"${l.changeSummary}"`, l.status].join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${logs.length} entries (current page)`);
  };

  const openDetail = (log: AuditLogEntry) => {
    setSelectedLog(log);
    setPanelOpen(true);
  };

  const fmtTimestamp = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
  };

  return (
    <>
      <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">System / Audit Logs</p>
            <h1 className="text-xl font-semibold tracking-tight">Audit Logs</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Track all administrative actions and system changes</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <RetentionControl />
            <Button variant="outline" size="sm" className="rounded-full" onClick={handleExport}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export CSV
            </Button>
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => refetch()}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-3 pb-2 border-b border-border">
          <Input
            placeholder="Search logs…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="h-8 w-56 text-sm"
          />
          <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(1); }}>
            <SelectTrigger className="h-8 w-36 text-sm"><SelectValue placeholder="Action Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              {actionTypes.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={entityFilter} onValueChange={(v) => { setEntityFilter(v); setPage(1); }}>
            <SelectTrigger className="h-8 w-36 text-sm"><SelectValue placeholder="Entity Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Entities</SelectItem>
              {entityTypes.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="h-8 w-28 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {statusOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground rounded-full" onClick={clearFilters}>
              <X className="h-3 w-3 mr-1" />
              Clear filters
            </Button>
          )}
        </div>

        {/* Active filter chips */}
        {hasFilters && (
          <div className="flex flex-wrap gap-1.5">
            {search && <FilterChip label={`"${search}"`} onRemove={() => { setSearch(""); setPage(1); }} />}
            {actionFilter !== "all" && <FilterChip label={actionFilter} onRemove={() => { setActionFilter("all"); setPage(1); }} />}
            {entityFilter !== "all" && <FilterChip label={entityFilter} onRemove={() => { setEntityFilter("all"); setPage(1); }} />}
            {statusFilter !== "all" && <FilterChip label={statusFilter} onRemove={() => { setStatusFilter("all"); setPage(1); }} />}
          </div>
        )}

        {/* Table */}
        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-xs font-medium w-44">Timestamp</TableHead>
                <TableHead className="text-xs font-medium">Admin</TableHead>
                <TableHead className="text-xs font-medium">Action</TableHead>
                <TableHead className="text-xs font-medium">Entity</TableHead>
                <TableHead className="text-xs font-medium hidden lg:table-cell">Summary</TableHead>
                <TableHead className="text-xs font-medium w-24 text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-sm text-muted-foreground">
                    Loading audit logs…
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-sm text-muted-foreground">
                    {hasFilters ? "No audit logs match your filters." : "No administrative actions recorded yet."}
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow
                    key={log.id}
                    className="cursor-pointer hover:bg-muted/40 transition-colors"
                    onClick={() => openDetail(log)}
                  >
                    <TableCell className="text-xs font-mono text-muted-foreground py-3">{fmtTimestamp(log.timestamp)}</TableCell>
                    <TableCell className="text-sm font-medium py-3">{log.adminUser}</TableCell>
                    <TableCell className="py-3">
                      <Badge variant="secondary" className="text-xs font-normal">
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="text-sm">{log.entityName}</div>
                      <div className="text-xs text-muted-foreground">{log.entityType} · {log.entityId}</div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground hidden lg:table-cell py-3 max-w-[240px] truncate">
                      {log.changeSummary}
                    </TableCell>
                    <TableCell className="text-center py-3">
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-xs font-normal",
                          log.status === "Success"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                            : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400"
                        )}
                      >
                        {log.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          <AdminPagination
            page={page}
            limit={limit}
            total={total}
            totalPages={totalPages}
            onPageChange={setPage}
            onLimitChange={(l) => { setLimit(l); setPage(1); }}
            label="entries"
          />
        </div>
      </div>

      <AuditLogDetailPanel log={selectedLog} open={panelOpen} onOpenChange={setPanelOpen} />
    </>
  );
}

function RetentionControl() {
  const { data } = useAuditRetention();
  const update = useUpdateAuditRetention();
  const [value, setValue] = useState("");

  // Seed the input once the setting loads (or when it changes upstream).
  const serverDays = data?.days;
  useEffect(() => {
    if (serverDays !== undefined) setValue(String(serverDays));
  }, [serverDays]);

  if (!data) return null;

  const parsed = Number(value);
  const valid = Number.isInteger(parsed) && parsed >= data.min && parsed <= data.max;
  const changed = valid && parsed !== data.days;

  const save = () => {
    if (!changed) return;
    update.mutate(parsed, {
      onSuccess: (days) => toast.success(`Audit logs now kept for ${days} days`),
      onError: () => toast.error("Couldn't update retention window"),
    });
  };

  return (
    <div className="flex items-center gap-1.5" title="Older audit logs are auto-deleted nightly">
      <label htmlFor="retention" className="text-xs text-muted-foreground whitespace-nowrap">
        Keep logs
      </label>
      <Input
        id="retention"
        type="number"
        min={data.min}
        max={data.max}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && save()}
        className="h-8 w-[4.5rem] text-sm"
      />
      <span className="text-xs text-muted-foreground">days</span>
      <Button
        variant="outline"
        size="sm"
        className="rounded-full"
        disabled={!changed || update.isPending}
        onClick={save}
      >
        {update.isPending ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-foreground">
      {label}
      <button onClick={onRemove} className="hover:text-destructive">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
