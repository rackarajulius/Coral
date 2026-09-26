import { RefObject } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { AppNotification } from "@/data/employer/notifications/notifications-data";
import { NotificationDateGroup } from "./NotificationDateGroup";
import { NotificationsEmptyState } from "./NotificationsEmptyState";
import { DATE_GROUPS, type DateGroup, type NotificationTab } from "./types";

interface NotificationsFeedProps {
  tab: NotificationTab;
  loading: boolean;
  filtered: AppNotification[];
  groups: Record<DateGroup, AppNotification[]>;
  selectedIds: Set<string>;
  hasMore: boolean;
  loadingMore: boolean;
  sentinelRef: RefObject<HTMLDivElement | null>;
  onToggleSelect: (id: string) => void;
  onMarkRead: (id: string, read: boolean) => void;
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
  onDelete: (id: string) => void;
  onOpen: (id: string) => void;
}

export function NotificationsFeed({
  tab,
  loading,
  filtered,
  groups,
  selectedIds,
  hasMore,
  loadingMore,
  sentinelRef,
  onToggleSelect,
  onMarkRead,
  onArchive,
  onUnarchive,
  onDelete,
  onOpen,
}: NotificationsFeedProps) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
      {loading ? (
        <div className="divide-y divide-border">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-start gap-4 px-5 py-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-5/6" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <NotificationsEmptyState tab={tab} />
      ) : (
        <div>
          {DATE_GROUPS.map((g) => (
            <NotificationDateGroup
              key={g}
              label={g}
              items={groups[g]}
              selectedIds={selectedIds}
              onToggleSelect={onToggleSelect}
              onMarkRead={onMarkRead}
              onArchive={onArchive}
              onUnarchive={onUnarchive}
              onDelete={onDelete}
              onOpen={onOpen}
            />
          ))}
          <div ref={sentinelRef} className="px-5 py-6 text-center">
            {loadingMore ? (
              <div className="space-y-2">
                <Skeleton className="mx-auto h-3 w-32" />
                <Skeleton className="mx-auto h-3 w-48" />
              </div>
            ) : hasMore ? (
              <span className="text-xs text-muted-foreground">Scroll to load more</span>
            ) : (
              <span className="text-xs text-muted-foreground">You're all caught up</span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
