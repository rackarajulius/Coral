import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCheck, Archive, ArchiveRestore, Trash2 } from "lucide-react";
import type { NotificationTab } from "./types";

interface BulkActionBarProps {
  selectedCount: number;
  allSelected: boolean;
  tab: NotificationTab;
  onToggleSelectAll: (selectAll: boolean) => void;
  onClearSelection: () => void;
  onMarkRead: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
}

export function BulkActionBar({
  selectedCount,
  allSelected,
  tab,
  onToggleSelectAll,
  onClearSelection,
  onMarkRead,
  onArchive,
  onUnarchive,
  onDelete,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="mb-3 flex items-center justify-between rounded-xl border border-border bg-card px-4 py-2.5 shadow-card">
      <div className="flex items-center gap-3 text-sm">
        <Checkbox
          checked={allSelected}
          onCheckedChange={(v) => onToggleSelectAll(!!v)}
        />
        <span className="font-medium text-foreground">{selectedCount} selected</span>
        <button
          type="button"
          onClick={onClearSelection}
          className="text-muted-foreground hover:text-foreground"
        >
          Clear
        </button>
      </div>
      <div className="flex items-center gap-1.5">
        <Button variant="ghost" size="sm" className="h-8 gap-2" onClick={onMarkRead}>
          <CheckCheck className="h-4 w-4" /> Mark read
        </Button>
        {tab === "archived" ? (
          <Button variant="ghost" size="sm" className="h-8 gap-2" onClick={onUnarchive}>
            <ArchiveRestore className="h-4 w-4" /> Unarchive
          </Button>
        ) : (
          <Button variant="ghost" size="sm" className="h-8 gap-2" onClick={onArchive}>
            <Archive className="h-4 w-4" /> Archive
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-2 text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" /> Delete
        </Button>
      </div>
    </div>
  );
}
