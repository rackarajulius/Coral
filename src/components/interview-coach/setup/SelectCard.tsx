import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Radio-style selectable card used across the wizard steps. */
export default function SelectCard({
  selected,
  onSelect,
  title,
  description,
  meta,
  children,
  className,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description?: string;
  meta?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "group relative rounded-2xl border p-5 text-left transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral",
        selected
          ? "border-coral/70 bg-coral/10 shadow-[0_0_0_1px_rgba(237,122,79,0.45)]"
          : "border-ink/10 bg-surface hover:border-ink/25",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={cn("font-display text-sm font-semibold", selected ? "text-ink" : "text-ink")}>
          {title}
        </p>
        {meta && <span className="tabular shrink-0 text-[11px] text-ink-dim">{meta}</span>}
      </div>
      {description && <p className="mt-1.5 text-xs leading-relaxed text-ink-dim">{description}</p>}
      {children}
      <span
        aria-hidden="true"
        className={cn(
          "absolute right-4 top-4 h-2 w-2 rounded-full transition-colors",
          selected ? "bg-coral" : "bg-transparent",
        )}
      />
    </button>
  );
}
