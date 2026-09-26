// Parse an ISO date (YYYY-MM-DD) as a local midnight Date to avoid UTC day-shift.
export function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatShortDate(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatInterviewDate(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// Whole-day difference between the given date and today (positive = future).
export function daysUntil(iso: string): number {
  const target = parseLocalDate(iso).getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today.getTime()) / 86_400_000);
}

export function interviewCountdown(iso: string): string {
  const n = daysUntil(iso);
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n > 1) return `in ${n} days`;
  if (n === -1) return "Yesterday";
  return `${Math.abs(n)} days ago`;
}

export type InterviewWhen = "today" | "upcoming" | "past";

export function interviewWhen(iso: string): InterviewWhen {
  const date = parseLocalDate(iso).getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date === today.getTime()) return "today";
  return date > today.getTime() ? "upcoming" : "past";
}

export const INTERVIEW_WHEN_META: Record<InterviewWhen, { label: string; badge: string }> = {
  today: { label: "Today", badge: "bg-[#FFFBEB] text-[#B45309]" },
  upcoming: { label: "Upcoming", badge: "bg-[#EFF6FF] text-[#1D4ED8]" },
  past: { label: "Completed", badge: "bg-[#F3F4F6] text-[#4B5563]" },
};
