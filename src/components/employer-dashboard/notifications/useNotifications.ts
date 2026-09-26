import { useMemo, useRef, useState, useDeferredValue } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type AppNotification as ServerNotification,
} from "@/lib/api/notifications";
import { AppNotification, NotificationType } from "@/data/employer/notifications/notifications-data";
import { groupByDate } from "./utils";
import type { NotificationTab } from "./types";

type DeliveryFrequency = "instant" | "hourly" | "daily";

const QUERY_KEY = ["employer-notifications"] as const;

/** Backend notification `type` string → the UI's notification category. */
function mapType(t: string): NotificationType {
  switch (t) {
    case "interview":
      return "interview";
    case "application":
    case "ai_screen":
      return "application";
    case "message":
    case "outreach":
      return "message";
    case "mention":
      return "mention";
    case "security":
      return "security";
    default:
      return "workflow";
  }
}

/** Neutral source label per category (server notifications carry no actor). */
const SOURCE_LABEL: Record<NotificationType, string> = {
  application: "Applications",
  interview: "Interviews",
  message: "Messages",
  mention: "Mentions",
  security: "Security",
  workflow: "Coral",
};

function toUi(n: ServerNotification): AppNotification {
  const type = mapType(n.type);
  return {
    id: n.id,
    type,
    title: n.title,
    description: n.message,
    timestamp: n.createdAt,
    read: n.readAt != null,
    actor: { name: SOURCE_LABEL[type] },
    link: n.link ?? undefined,
  };
}

export function useNotifications() {
  const queryClient = useQueryClient();
  const { data: serverItems = [], isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => (await getMyNotifications()).data,
    refetchInterval: 30_000, // near-real-time without a socket
    refetchOnWindowFocus: true,
  });

  // Local overlays for state the backend doesn't model (archive/remove) or that
  // we apply optimistically (read) before the next refetch confirms it.
  const [readOverlay, setReadOverlay] = useState<Set<string>>(new Set());
  const [archivedIds, setArchivedIds] = useState<Set<string>>(new Set());
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());

  const [tab, setTab] = useState<NotificationTab>("all");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [typeFilters, setTypeFilters] = useState<Record<NotificationType, boolean>>({
    application: true,
    interview: true,
    message: true,
    mention: true,
    security: true,
    workflow: true,
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deliveryFrequency, setDeliveryFrequency] = useState<DeliveryFrequency>("instant");
  const sentinelRef = useRef<HTMLDivElement>(null);

  const items = useMemo<AppNotification[]>(
    () =>
      serverItems
        .filter((n) => !removedIds.has(n.id))
        .map((n) => {
          const ui = toUi(n);
          return {
            ...ui,
            read: ui.read || readOverlay.has(n.id),
            archived: archivedIds.has(n.id),
          };
        }),
    [serverItems, readOverlay, archivedIds, removedIds],
  );

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return items.filter((n) => {
      if (!typeFilters[n.type]) return false;
      if (tab === "unread" && n.read) return false;
      if (tab === "mentions" && n.type !== "mention") return false;
      if (tab === "archived" && !n.archived) return false;
      if (tab !== "archived" && n.archived) return false;
      if (q) {
        const hay = `${n.title} ${n.description} ${n.actor.name}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, deferredQuery, typeFilters, tab]);

  const unreadCount = useMemo(() => items.filter((n) => !n.read && !n.archived).length, [items]);

  const groups = useMemo(() => groupByDate(filtered), [filtered]);
  const allVisibleIds = filtered.map((n) => n.id);
  const allSelected = allVisibleIds.length > 0 && allVisibleIds.every((id) => selected.has(id));
  const activeNotification = items.find((n) => n.id === activeId) ?? null;

  const clearSelection = () => setSelected(new Set());

  const toggleSelected = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const selectAllVisible = () => setSelected(new Set(allVisibleIds));

  const changeTab = (next: NotificationTab) => {
    setTab(next);
    clearSelection();
  };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  const markAllRead = () => {
    setReadOverlay(new Set(items.map((n) => n.id)));
    markAllNotificationsRead()
      .then(invalidate)
      .catch(() => toast.error("Couldn't mark all as read"));
    toast.success("All notifications marked as read");
  };

  const markRead = (ids: string[], read = true) => {
    if (read) {
      setReadOverlay((prev) => new Set([...prev, ...ids]));
      Promise.all(ids.map((id) => markNotificationRead(id))).then(invalidate).catch(() => undefined);
    } else {
      // The backend has no "mark unread"; keep it local only.
      setReadOverlay((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    }
  };

  // Archive / remove are session-local (the backend doesn't model them yet).
  const archive = (ids: string[]) => {
    setArchivedIds((prev) => new Set([...prev, ...ids]));
    toast.success(`${ids.length} archived`, {
      action: {
        label: "Undo",
        onClick: () =>
          setArchivedIds((prev) => {
            const next = new Set(prev);
            ids.forEach((id) => next.delete(id));
            return next;
          }),
      },
    });
    clearSelection();
  };

  const unarchive = (ids: string[]) => {
    setArchivedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    toast.success(`${ids.length} unarchived`);
    clearSelection();
  };

  const remove = (ids: string[]) => {
    setRemovedIds((prev) => new Set([...prev, ...ids]));
    toast.success(`${ids.length} removed from view`, {
      action: {
        label: "Undo",
        onClick: () =>
          setRemovedIds((prev) => {
            const next = new Set(prev);
            ids.forEach((id) => next.delete(id));
            return next;
          }),
      },
    });
    clearSelection();
  };

  const markSelectedRead = () => {
    markRead(Array.from(selected));
    toast.success(`${selected.size} marked as read`);
    clearSelection();
  };

  const openThread = (id: string) => {
    setActiveId(id);
    setDrawerOpen(true);
    markRead([id], true);
  };

  return {
    tab,
    changeTab,
    query,
    setQuery,
    typeFilters,
    setTypeFilters,
    selected,
    toggleSelected,
    clearSelection,
    selectAllVisible,
    loading: isLoading,
    hasMore: false,
    loadingMore: false,
    sentinelRef,
    drawerOpen,
    setDrawerOpen,
    filtered,
    unreadCount,
    groups,
    allSelected,
    markAllRead,
    markRead,
    archive,
    unarchive,
    remove,
    markSelectedRead,
    openThread,
    activeNotification,
    deliveryFrequency,
    setDeliveryFrequency,
  };
}
