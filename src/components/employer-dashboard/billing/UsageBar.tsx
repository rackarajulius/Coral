import { cn } from "@/lib/utils";

interface UsageBarProps {
  value: number;
  className?: string;
}

export function UsageBar({ value, className }: UsageBarProps) {
  const pct = Math.min(value, 100);
  const warning = pct >= 85;
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div
        className={cn(
          "h-full rounded-full transition-all duration-700 ease-out",
          warning ? "bg-accent" : "bg-navy"
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
