import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { SectionCard } from "./shared";
import {
  CATEGORY_LABELS, listAuditLog, type AuditCategory, type AuditEntry,
} from "@/lib/api/companyAudit";

const PAGE_SIZE = 50;

/**
 * The company's activity trail.
 *
 * Entries are written at the time of each action, not derived from current
 * rows — a row only holds its latest state, so "who changed this role" is
 * unanswerable afterwards and deletions leave nothing behind at all.
 */
export default function AuditLogs() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<AuditCategory | "all">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const log = useQuery({
    queryKey: ["company-audit", q, category, from, to, page],
    queryFn: () =>
      listAuditLog({
        q,
        category: category === "all" ? undefined : category,
        from: from || undefined,
        to: to || undefined,
        page,
        limit: PAGE_SIZE,
      }),
    retry: false,
  });

  const entries = log.data?.entries ?? [];
  const hasFilters = q !== "" || category !== "all" || from !== "" || to !== "";

  const exportCsv = () => {
    const headers = ["When", "Who", "Category", "Action", "Detail"];
    const rows = entries.map((e) => [
      new Date(e.createdAt).toISOString(),
      e.actorName,
      CATEGORY_LABELS[e.category],
      e.action,
      e.summary,
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `activity-log-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    // Says what actually left, not what exists: the export covers this page.
    toast.success("Exported", {
      description: `${entries.length} ${entries.length === 1 ? "entry" : "entries"} from this page.`,
    });
  };

  const resetToFirstPage = <T,>(setter: (v: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  return (
    <SectionCard
      title="Activity log"
      description="Who did what in this company. Kept for a year."
      action={
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search"
              className="h-9 w-52 pl-9"
              value={q}
              onChange={(e) => resetToFirstPage(setQ)(e.target.value)}
            />
          </div>
          <Select
            value={category}
            onValueChange={(v) => resetToFirstPage(setCategory)(v as AuditCategory | "all")}
          >
            <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All activity</SelectItem>
              {(Object.keys(CATEGORY_LABELS) as AuditCategory[]).map((c) => (
                <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={entries.length === 0}>
            <Download className="h-4 w-4" />Export
          </Button>
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap text-xs text-muted-foreground">From</span>
          <Input
            type="date"
            className="h-8 w-36 text-sm"
            value={from}
            onChange={(e) => resetToFirstPage(setFrom)(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap text-xs text-muted-foreground">To</span>
          <Input
            type="date"
            className="h-8 w-36 text-sm"
            value={to}
            onChange={(e) => resetToFirstPage(setTo)(e.target.value)}
          />
        </div>
        {(from || to) && (
          <button
            type="button"
            onClick={() => { setFrom(""); setTo(""); setPage(1); }}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Clear dates
          </button>
        )}
      </div>

      {log.isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
        </div>
      ) : log.isError ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {(log.error as Error)?.message || "Couldn't load the activity log."}
        </p>
      ) : entries.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {hasFilters
            ? "No activity matches your filters."
            : "Nothing recorded yet. Team changes, job edits and candidate moves will appear here."}
        </p>
      ) : (
        <>
          <div className="space-y-1">
            {entries.map((e) => <Row key={e.id} entry={e} />)}
          </div>

          {(log.data?.totalPages ?? 1) > 1 && (
            <div className="mt-5 flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Page {log.data?.page} of {log.data?.totalPages} · {log.data?.total} entries
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  disabled={page === 1 || log.isFetching}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= (log.data?.totalPages ?? 1) || log.isFetching}
                >
                  {log.isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </SectionCard>
  );
}

function Row({ entry }: { entry: AuditEntry }) {
  const initials = entry.actorName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex items-center gap-4 rounded-lg p-3 transition-colors hover:bg-secondary/40">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className="bg-secondary text-xs">{initials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <span className="font-medium">{entry.actorName}</span>{" "}
          <span className="text-muted-foreground">{entry.summary}</span>
        </p>
      </div>
      <Badge variant="outline" className="shrink-0 text-xs font-normal">
        {CATEGORY_LABELS[entry.category]}
      </Badge>
      <span className="w-40 shrink-0 text-right text-xs text-muted-foreground">
        {new Date(entry.createdAt).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })}
      </span>
    </div>
  );
}
