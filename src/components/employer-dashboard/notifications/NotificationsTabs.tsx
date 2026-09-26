import { cn } from "@/lib/utils";
import type { NotificationTab } from "./types";

const TABS: { id: NotificationTab; label: string; countKey?: "unread" }[] = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread", countKey: "unread" },
  { id: "mentions", label: "Mentions" },
  { id: "archived", label: "Archived" },
];

interface NotificationsTabsProps {
  tab: NotificationTab;
  unreadCount: number;
  onTabChange: (tab: NotificationTab) => void;
}

export function NotificationsTabs({ tab, unreadCount, onTabChange }: NotificationsTabsProps) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3 border-b border-border">
      <div className="flex gap-1">
        {TABS.map((t) => {
          const count = t.countKey === "unread" ? unreadCount : undefined;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onTabChange(t.id)}
              className={cn(
                "relative -mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                tab === t.id
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
              {!!count && (
                <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-foreground">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="hidden items-center gap-2 pr-1 text-xs text-muted-foreground md:flex">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        Real-time connected
      </div>
    </div>
  );
}
