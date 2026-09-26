import { useState } from "react";
import { format } from "date-fns";
import { FileText, MoreHorizontal, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { difficultyLabel, interviewTypeLabel } from "@/data/interview-coach/constants";
import type { HistoryEntry } from "@/data/interview-coach/types";
import { useInterviewHistoryStore } from "@/stores/interviewHistoryStore";
import { useInterviewSetupStore } from "@/stores/interviewSetupStore";

const scoreTone = (score: number) =>
  score >= 75 ? "text-emerald-400" : score >= 55 ? "text-amber-400" : "text-rose-400";

const fmtDuration = (sec: number) => `${Math.max(1, Math.round(sec / 60))}m`;

function Improvement({ value }: { value?: number }) {
  if (value == null) return <span className="text-ink-dim">—</span>;
  return (
    <span className={value >= 0 ? "text-emerald-400" : "text-rose-400"}>
      {value >= 0 ? "+" : ""}
      {value}
    </span>
  );
}

function RowActions({
  entry,
  onView,
  onDelete,
}: {
  entry: HistoryEntry;
  onView: () => void;
  onDelete: () => void;
}) {
  const prefillFrom = useInterviewSetupStore((s) => s.prefillFrom);
  const openSetup = useInterviewSetupStore((s) => s.openModal);

  const practiceAgain = () => {
    prefillFrom(entry.config);
    openSetup();
  };

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full text-ink-dim hover:bg-surface-2 hover:text-ink"
          aria-label={`Actions for ${entry.config.role} interview`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="booth-light border-ink/10 bg-surface text-ink">
        <DropdownMenuItem onClick={onView}>
          <FileText className="mr-2 h-4 w-4" /> View report
        </DropdownMenuItem>
        <DropdownMenuItem onClick={practiceAgain}>
          <RotateCcw className="mr-2 h-4 w-4" /> Practice again
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDelete} className="text-rose-400 focus:text-rose-400">
          <Trash2 className="mr-2 h-4 w-4" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function HistoryTable({
  entries,
  onSelect,
}: {
  entries: HistoryEntry[];
  onSelect: (id: string) => void;
}) {
  const remove = useInterviewHistoryStore((s) => s.remove);
  const [pendingDelete, setPendingDelete] = useState<HistoryEntry | null>(null);

  const confirmDelete = () => {
    if (!pendingDelete) return;
    remove(pendingDelete.id);
    toast.success("Interview deleted");
    setPendingDelete(null);
  };

  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-2xl border border-ink/10 bg-surface md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wide text-ink-dim">
              <th className="px-5 py-3.5 font-medium">Role</th>
              <th className="px-4 py-3.5 font-medium">Type</th>
              <th className="px-4 py-3.5 font-medium">Date</th>
              <th className="px-4 py-3.5 font-medium">Duration</th>
              <th className="px-4 py-3.5 font-medium">Difficulty</th>
              <th className="px-4 py-3.5 text-right font-medium">Score</th>
              <th className="px-4 py-3.5 text-right font-medium">Change</th>
              <th className="px-4 py-3.5" />
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr
                key={e.id}
                onClick={() => onSelect(e.id)}
                className="cursor-pointer border-b border-ink/5 transition-colors last:border-0 hover:bg-surface-2/60"
              >
                <td className="px-5 py-4 font-medium text-ink">{e.config.role}</td>
                <td className="px-4 py-4 text-ink-dim">{interviewTypeLabel(e.config.type)}</td>
                <td className="px-4 py-4 text-ink-dim">{format(new Date(e.createdAt), "MMM d, yyyy")}</td>
                <td className="tabular px-4 py-4 text-ink-dim">{fmtDuration(e.durationSec)}</td>
                <td className="px-4 py-4">
                  <Badge variant="outline">{difficultyLabel(e.config.difficulty)}</Badge>
                </td>
                <td className={cn("tabular px-4 py-4 text-right font-display text-base font-semibold", scoreTone(e.overallScore))}>
                  {e.overallScore}
                </td>
                <td className="tabular px-4 py-4 text-right">
                  <Improvement value={e.improvementVsPrev} />
                </td>
                <td className="px-4 py-4 text-right" onClick={(ev) => ev.stopPropagation()}>
                  <RowActions
                    entry={e}
                    onView={() => onSelect(e.id)}
                    onDelete={() => setPendingDelete(e)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="space-y-3 md:hidden">
        {entries.map((e) => (
          <li key={e.id} className="rounded-2xl border border-ink/10 bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">{e.config.role}</p>
                <p className="mt-0.5 text-xs text-ink-dim">
                  {interviewTypeLabel(e.config.type)} · {format(new Date(e.createdAt), "MMM d")} ·{" "}
                  {fmtDuration(e.durationSec)}
                </p>
              </div>
              <RowActions
                entry={e}
                onView={() => onSelect(e.id)}
                onDelete={() => setPendingDelete(e)}
              />
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className={cn("tabular font-display text-xl font-semibold", scoreTone(e.overallScore))}>
                {e.overallScore}
              </span>
              <span className="tabular text-xs">
                <Improvement value={e.improvementVsPrev} />
              </span>
            </div>
          </li>
        ))}
      </ul>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent className="booth-light border-gay-300 bg-card text-ink">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this interview?</AlertDialogTitle>
            <AlertDialogDescription className="text-ink-dim">
              The session, transcript, and report for “{pendingDelete?.config.role}” will be
              permanently removed. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-ink/15 bg-transparent text-ink hover:bg-surface-2 hover:text-ink h-10 px-4 py-2 h-9 rounded-full px-3">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-white hover:bg-destructive-400 h-10 px-4 py-2 h-9 rounded-full px-3">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
