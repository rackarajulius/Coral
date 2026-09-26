import type { AppNotification } from "@/data/employer/notifications/notifications-data";
import { NotificationRow } from "./NotificationRow";
import type { DateGroup } from "./types";

interface NotificationDateGroupProps {
  label: DateGroup;
  items: AppNotification[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onMarkRead: (id: string, read: boolean) => void;
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
  onDelete: (id: string) => void;
  onOpen: (id: string) => void;
}

export function NotificationDateGroup({
  label,
  items,
  selectedIds,
  onToggleSelect,
  onMarkRead,
  onArchive,
  onUnarchive,
  onDelete,
  onOpen,
}: NotificationDateGroupProps) {
  if (items.length === 0) return null;

  return (
    <div>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card/95 px-5 py-2 backdrop-blur">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="text-[11px] text-muted-foreground">{items.length}</span>
      </div>
      <ul className="divide-y divide-border">
        {items.map((n) => (
          <NotificationRow
            key={n.id}
            notification={n}
            selected={selectedIds.has(n.id)}
            onToggleSelect={() => onToggleSelect(n.id)}
            onMarkRead={(read) => onMarkRead(n.id, read)}
            onArchive={() => onArchive(n.id)}
            onUnarchive={() => onUnarchive(n.id)}
            onDelete={() => onDelete(n.id)}
            onOpen={() => onOpen(n.id)}
          />
        ))}
      </ul>
    </div>
  );
}
