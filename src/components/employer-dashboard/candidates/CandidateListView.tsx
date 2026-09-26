import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { BulkMessageDialog } from "./BulkMessageDialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, ArrowDown, ArrowUp, X, ChevronRight, Download, SearchX, Sparkles, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Candidate, Stage } from "@/data/employer/Candidates/types";
import { STAGES } from "@/data/employer/Candidates/types";
import { matchTone, formatRelative } from "./candidateUtils";
import { ScreenBatchDialog } from "./ScreenBatchDialog";
import { toast } from "sonner";

type SortKey = "name" | "role" | "stage" | "matchScore" | "appliedDate" | "status";
type SortDir = "asc" | "desc";

interface Props {
  candidates: Candidate[];
  onSelect: (c: Candidate) => void;
  onBulkMove: (ids: string[], stage: Stage) => void;
  onBulkReject: (ids: string[]) => void;
  /** Whether this seat may move people through the pipeline. */
  canMove?: boolean;
  onClearFilters?: () => void;
}

export function CandidatesListView({
  candidates,
  onSelect,
  onBulkMove,
  onBulkReject,
  onClearFilters,
  canMove = true,
}: Props) {
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "matchScore", dir: "desc" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [messageOpen, setMessageOpen] = useState(false);
  const [screenOpen, setScreenOpen] = useState(false);

  const selectedCandidates = useMemo(
    () => candidates.filter((c) => selected.has(c.id)),
    [candidates, selected],
  );

  const sorted = useMemo(() => {
    const arr = [...candidates];
    arr.sort((a, b) => {
      const va = a[sort.key] as string | number;
      const vb = b[sort.key] as string | number;
      if (va < vb) return sort.dir === "asc" ? -1 : 1;
      if (va > vb) return sort.dir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [candidates, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  const allChecked = selected.size > 0 && selected.size === sorted.length;
  const someChecked = selected.size > 0 && selected.size < sorted.length;

  const toggleAll = () => {
    if (allChecked) setSelected(new Set());
    else setSelected(new Set(sorted.map((c) => c.id)));
  };

  const toggleOne = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const SortHeader = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <TableHead>
      <button
        onClick={() => toggleSort(k)}
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        {children}
        {sort.key === k ? (
          sort.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-50" />
        )}
      </button>
    </TableHead>
  );

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <ScreenBatchDialog
        open={screenOpen}
        onOpenChange={setScreenOpen}
        candidates={selectedCandidates}
        onSent={() => setSelected(new Set())}
      />
      {/* Selection is application ids, which is exactly what bulk send needs. */}
      <BulkMessageDialog
        open={messageOpen}
        onClose={() => setMessageOpen(false)}
        applicationIds={[...selected]}
        onSent={() => setSelected(new Set())}
      />
      {selected.size > 0 && (
        <div className="flex items-center justify-between gap-3 border-b border-border bg-primary-soft/50 px-4 py-2.5">
          <div className="text-sm">
            <span className="font-medium">{selected.size}</span>{" "}
            <span className="text-muted-foreground">selected</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Messaging stays: writing to someone is not deciding about them.
                Moving and rejecting are, and the server refuses both from a
                comment-only seat. */}
            <div className={cn("flex items-center gap-1", !canMove && "hidden")}>
              <span className="text-xs text-muted-foreground mr-1">Move to:</span>
              {STAGES.map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    onBulkMove([...selected], s);
                    setSelected(new Set());
                    toast.success(`Moved ${selected.size} to ${s}`);
                  }}
                >
                  {s}
                </Button>
              ))}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={() => setMessageOpen(true)}
            >
              <Mail className="h-3 w-3" /> Message
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={() => setScreenOpen(true)}
            >
              <Sparkles className="h-3 w-3" /> AI screen
            </Button>
            {canMove && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => {
                  onBulkReject([...selected]);
                  toast(`Rejected ${selected.size} candidate(s)`);
                  setSelected(new Set());
                }}
              >
                <X className="h-3 w-3" /> Reject
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={() => {
                const header = ["Name", "Email", "Role", "Stage", "Match Score", "Applied Date"];
                const rows = [...selected].map((id) => {
                  const c = sorted.find((c) => c.id === id)!;
                  return [c.name, c.email, c.role, c.stage, c.matchScore, c.appliedDate];
                });
                const csv = [header, ...rows]
                  .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
                  .join("\n");
                const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `candidates-${new Date().toISOString().slice(0, 10)}.csv`;
                a.click();
                URL.revokeObjectURL(url);
                toast.success(`Exported ${selected.size} candidate(s) as CSV`);
              }}
            >
              <Download className="h-3 w-3" /> Export
            </Button>
          </div>
        </div>
      )}

      <Table>
        <TableHeader className="sticky top-0 bg-muted/40 backdrop-blur z-10">
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10">
              <Checkbox checked={allChecked ? true : someChecked ? "indeterminate" : false} onCheckedChange={toggleAll} />
            </TableHead>
            <SortHeader k="name">Name</SortHeader>
            <SortHeader k="role">Job</SortHeader>
            <SortHeader k="stage">Stage</SortHeader>
            <SortHeader k="matchScore">Match</SortHeader>
            <SortHeader k="appliedDate">Applied</SortHeader>
            <SortHeader k="status">Status</SortHeader>
            <TableHead className="w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="py-20">
                <div className="flex flex-col items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <SearchX className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">No candidates found</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Try adjusting your search or filters.</p>
                  </div>
                  {onClearFilters && (
                    <Button size="sm" variant="outline" onClick={onClearFilters}>
                      Clear all filters
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ) : (
            sorted.map((c) => (
              <TableRow
                key={c.id}
                className="cursor-pointer"
                onClick={() => onSelect(c)}
                data-state={selected.has(c.id) ? "selected" : undefined}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggleOne(c.id)} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary-soft text-primary text-xs font-semibold">
                        {c.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{c.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{c.email}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm">{c.role}</TableCell>
                <TableCell>
                  <Badge variant="outline">{c.stage}</Badge>
                </TableCell>
                <TableCell>
                  <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset tabular-nums", matchTone(c.matchScore))}>
                    {c.matchScore == null ? "—" : `${c.matchScore}%`}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatRelative(c.appliedDate)}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5 text-xs">
                    <span className={cn("h-1.5 w-1.5 rounded-full", c.status === "Active" ? "bg-emerald-500" : c.status === "On hold" ? "bg-amber-500" : "bg-muted-foreground")} />
                    {c.status}
                  </span>
                </TableCell>
                <TableCell>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
