export const DRAWER_CLOSE_MS = 320;

export function formatRelative(iso: string) {
  const d = new Date(iso);
  const days = Math.max(0, Math.round((Date.now() - d.getTime()) / 86400000));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.round(days / 7)}w ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function matchTone(score: number | null) {
  if (score == null) return "bg-muted text-muted-foreground ring-border";
  if (score >= 90) return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20";
  if (score >= 80) return "bg-primary-soft text-primary ring-primary/20";
  if (score >= 70) return "bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-500/20";
  return "bg-muted text-muted-foreground ring-border";
}
