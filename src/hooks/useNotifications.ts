import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/api/notifications";

/** Shared notifications feed for the navbar bell (employer / admin / public). */
export function useNotifications() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: getMyNotifications,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000, // light polling so the badge stays fresh
    refetchOnWindowFocus: true,
  });

  const markRead = async (id: string) => {
    await markNotificationRead(id);
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  const markAllRead = async () => {
    await markAllNotificationsRead();
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  return {
    notifications: query.data?.data ?? [],
    unreadCount: query.data?.unreadCount ?? 0,
    isLoading: query.isLoading,
    markRead,
    markAllRead,
  };
}
