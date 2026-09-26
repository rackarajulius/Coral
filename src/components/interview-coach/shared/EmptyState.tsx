import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export default function EmptyState({
  icon: Icon,
  heading,
  body,
  children,
  className,
}: {
  icon: LucideIcon;
  heading: string;
  body: string;
  /** CTA buttons. */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-3xl border border-ink/10 bg-surface/60 px-6 py-16 text-center",
        className,
      )}
    >
      <div className="mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-surface-2 ring-1 ring-ink/10">
        <Icon className="h-7 w-7 text-coral" aria-hidden="true" />
      </div>
      <h2 className="font-display text-xl font-semibold text-ink">{heading}</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-dim">{body}</p>
      {children && <div className="mt-6 flex flex-wrap items-center justify-center gap-3">{children}</div>}
    </div>
  );
}
