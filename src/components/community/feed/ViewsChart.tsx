import { useState } from "react";
import type { DailyViews } from "@/lib/api/community";

/**
 * One coral step that holds up on both the white and the dark card (checked:
 * contrast at least 3:1, inside the lightness band, in both modes).
 */
const VIEWS_COLOR = "#E0584B";

const compact = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });

/** The top of the axis: the next 1, 2 or 5 step above the tallest day. */
function niceMax(value: number): number {
  const top = Math.max(value, 1);
  const step = 10 ** Math.floor(Math.log10(top));
  for (const m of [1, 2, 5, 10]) if (m * step >= top) return m * step;
  return 10 * step;
}

function dayLabel(day: string, long = false): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short", day: "numeric", ...(long ? { weekday: "short" } : {}), timeZone: "UTC",
  });
}

/**
 * Views per day, as columns from one baseline.
 *
 * One series, so no legend: the caption says what it is. Each day shows its
 * number on hover or focus, and the same numbers are in a table for screen
 * readers.
 */
export function ViewsChart({ daily, caption }: { daily: DailyViews[]; caption: string }) {
  const [active, setActive] = useState<number | null>(null);
  const max = niceMax(Math.max(0, ...daily.map((d) => d.views)));
  const focused = active === null ? null : daily[active];

  return (
    <figure className="mt-1">
      <figcaption className="mb-2 text-xs font-medium text-muted-foreground">{caption}</figcaption>
      <div className="flex gap-2">
        {/* Axis: the top and the baseline, in muted ink. */}
        <div className="flex h-28 w-8 shrink-0 flex-col justify-between text-right text-[10px] tabular-nums text-muted-foreground" aria-hidden="true">
          <span className="-mt-1.5">{compact.format(max)}</span>
          <span className="-mb-1.5">0</span>
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-border" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-border" aria-hidden="true" />
          <div className="relative flex h-28 items-end gap-[2px] border-b border-border" onMouseLeave={() => setActive(null)}>
            {daily.map((d, i) => (
              // The whole column is the hover target, not just the bar.
              <button
                key={d.day}
                type="button"
                aria-label={`${dayLabel(d.day, true)}: ${d.views} ${d.views === 1 ? "view" : "views"}`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="flex h-full min-w-0 flex-1 items-end justify-center outline-none focus-visible:bg-muted/60"
              >
                <span
                  className="block w-full max-w-6 rounded-t-[4px] transition-opacity"
                  style={{
                    height: `${(d.views / max) * 100}%`,
                    backgroundColor: VIEWS_COLOR,
                    opacity: active === null || active === i ? 1 : 0.45,
                  }}
                />
              </button>
            ))}
          </div>
          {focused && active !== null && (
            // Just above the bar it describes, kept inside the plot's width.
            <div
              className="pointer-events-none absolute z-10 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-xs shadow-sm"
              style={{
                bottom: `calc(${(focused.views / max) * 7}rem + 1.5rem)`,
                left: `${((active + 0.5) / daily.length) * 100}%`,
                transform: `translateX(${active < daily.length / 4 ? "-15%" : active > (daily.length * 3) / 4 ? "-85%" : "-50%"})`,
              }}
              role="status"
            >
              <span className="text-muted-foreground">{dayLabel(focused.day, true)}</span>{" "}
              <span className="font-semibold tabular-nums">{focused.views.toLocaleString()}</span>
            </div>
          )}
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground" aria-hidden="true">
            <span>{daily[0] ? dayLabel(daily[0].day) : ""}</span>
            <span>{daily.length > 1 ? dayLabel(daily[daily.length - 1].day) : ""}</span>
          </div>
        </div>
      </div>

      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr><th scope="col">Day</th><th scope="col">Views</th></tr>
        </thead>
        <tbody>
          {daily.map((d) => (
            <tr key={d.day}><td>{dayLabel(d.day, true)}</td><td>{d.views}</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export default ViewsChart;
