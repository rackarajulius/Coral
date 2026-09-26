import supabase from "@/lib/supabase";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

export interface AppNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsResponse {
  data: AppNotification[];
  unreadCount: number;
}

async function authHeaders(): Promise<HeadersInit | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return null;
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  };
}

/** Current user's notifications + unread count. Returns empty when unauthenticated. */
export async function getMyNotifications(): Promise<NotificationsResponse> {
  const headers = await authHeaders();
  if (!headers) return { data: [], unreadCount: 0 };

  const res = await fetch(`${API_BASE_URL}/notifications/me`, { headers });
  if (!res.ok) throw new Error("Failed to load notifications");
  const json = await res.json();
  return { data: json.data ?? [], unreadCount: json.unreadCount ?? 0 };
}

export async function markNotificationRead(id: string): Promise<void> {
  const headers = await authHeaders();
  if (!headers) return;
  await fetch(`${API_BASE_URL}/notifications/${id}/read`, { method: "PATCH", headers });
}

export async function markAllNotificationsRead(): Promise<void> {
  const headers = await authHeaders();
  if (!headers) return;
  await fetch(`${API_BASE_URL}/notifications/me/read-all`, { method: "POST", headers });
}
