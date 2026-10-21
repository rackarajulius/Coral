import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationsResponse,
} from "@/lib/api/notifications";

const NOTIFICATIONS_KEY = ["notifications"] as const;

function relativeTime(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

/**
 * The bell and its panel, for the signed-in person.
 *
 * Shared by the main header and the community's own top bar, so the two tabs
 * show the same list off the same query rather than two copies drifting.
 */
export function NotificationBell() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  // Real notifications for the signed-in user (polled while mounted).
  const { data: notificationsData } = useQuery({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: getMyNotifications,
    enabled: isAuthenticated,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const notifications = notificationsData?.data ?? [];
  const unreadCount = notificationsData?.unreadCount ?? 0;

  const markReadMut = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_KEY });
      const prev = queryClient.getQueryData<NotificationsResponse>(NOTIFICATIONS_KEY);
      queryClient.setQueryData<NotificationsResponse>(NOTIFICATIONS_KEY, (old) =>
        old
          ? {
              data: old.data.map((n) => (n.id === id && !n.readAt ? { ...n, readAt: new Date().toISOString() } : n)),
              unreadCount: old.data.some((n) => n.id === id && !n.readAt)
                ? Math.max(0, old.unreadCount - 1)
                : old.unreadCount,
            }
          : old,
      );
      return { prev };
    },
    onError: (_e, _id, ctx) => ctx?.prev && queryClient.setQueryData(NOTIFICATIONS_KEY, ctx.prev),
    onSettled: () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
  });

  const markAllMut = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_KEY });
      const prev = queryClient.getQueryData<NotificationsResponse>(NOTIFICATIONS_KEY);
      queryClient.setQueryData<NotificationsResponse>(NOTIFICATIONS_KEY, (old) =>
        old
          ? { data: old.data.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })), unreadCount: 0 }
          : old,
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && queryClient.setQueryData(NOTIFICATIONS_KEY, ctx.prev),
    onSettled: () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
  });

  if (!isAuthenticated) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
        aria-expanded={isOpen}
        className="relative p-2 rounded-full hover:bg-muted transition-colors"
      >
        <Bell className="w-5 h-5 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-5 h-5
           px-1 text-xs font-semibold text-white bg-coral rounded-full">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Notification Panel - Desktop: Dropdown, Mobile: Full Screen */}
          <div className="fixed inset-x-0 bottom-0 h-[100dvh] max-h-none sm:absolute sm:h-auto sm:max-h-[32rem]
           sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:mt-2 w-full sm:w-96 bg-card border border-border
           rounded-t-lg sm:rounded-lg shadow-lg z-50 flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
              <h3 className="font-semibold text-base sm:text-sm">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllMut.mutate()}
                    className="text-xs text-muted-foreground hover:text-coral transition-colors"
                  >
                    Mark all read
                  </button>
                )}
                {/* Close button for mobile */}
                <button
                  onClick={() => setIsOpen(false)}
                  aria-label="Close notifications"
                  className="sm:hidden p-1 hover:bg-muted rounded-full transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Notification List */}
            <div className="overflow-y-auto flex-1">
              {notifications.length === 0 ? (
                <div className="p-8 sm:p-6 text-center text-muted-foreground">
                  <Bell className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">No notifications</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 border-b border-border last:border-b-0 hover:bg-coral/10 active:bg-coral/20
                       cursor-pointer transition-colors ${
                      !notification.readAt ? 'bg-coral/5' : ''
                    }`}
                    onClick={() => {
                      if (!notification.readAt) markReadMut.mutate(notification.id);
                      if (notification.link) {
                        setIsOpen(false);
                        navigate(notification.link);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">{notification.title}</p>
                          {!notification.readAt && (
                            <span className="w-2 h-2 bg-coral rounded-full shrink-0" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1.5">
                          {relativeTime(notification.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default NotificationBell;
