import { Bell, CheckCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNotifications } from "@/hooks/useNotifications";
import type { AppNotification } from "@/lib/api/notifications";
import { cn } from "@/lib/utils";

function relativeTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

interface NotificationBellProps {
  /** Classes for the trigger button so each navbar keeps its own look. */
  className?: string;
  /** Icon size class (defaults to h-[18px] w-[18px]). */
  iconClassName?: string;
}

export function NotificationBell({ className, iconClassName }: NotificationBellProps) {
  const navigate = useNavigate();
  const { notifications, unreadCount, markRead, markAllRead, isLoading } = useNotifications();

  const handleItem = (n: AppNotification) => {
    if (!n.readAt) markRead(n.id);
    if (n.link) navigate(n.link);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Notifications"
          className={cn(
            "relative flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors",
            className,
          )}
        >
          <Bell className={cn("h-[18px] w-[18px]", iconClassName)} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-0.5 text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => markAllRead()}
              className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </button>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="mx-auto mb-2 h-10 w-10 opacity-20" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => handleItem(n)}
                className={cn(
                  "flex w-full gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-0 hover:bg-muted/50",
                  !n.readAt && "bg-primary/5",
                )}
              >
                <span
                  className={cn(
                    "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                    n.readAt ? "bg-transparent" : "bg-primary",
                  )}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{n.title}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{n.message}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{relativeTime(n.createdAt)}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default NotificationBell;
