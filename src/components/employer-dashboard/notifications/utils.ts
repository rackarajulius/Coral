import type { AppNotification } from "@/data/employer/notifications/notifications-data";
import type { DateGroup } from "./types";

export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function groupByDate(items: AppNotification[]): Record<DateGroup, AppNotification[]> {
  const groups: Record<DateGroup, AppNotification[]> = {
    Today: [],
    Yesterday: [],
    "This week": [],
    Earlier: [],
  };
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86_400_000;
  const startOfWeek = startOfToday - 6 * 86_400_000;
  for (const n of items) {
    const t = new Date(n.timestamp).getTime();
    if (t >= startOfToday) groups.Today.push(n);
    else if (t >= startOfYesterday) groups.Yesterday.push(n);
    else if (t >= startOfWeek) groups["This week"].push(n);
    else groups.Earlier.push(n);
  }
  return groups;
}
