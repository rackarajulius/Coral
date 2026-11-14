import { useLayoutEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { accountSide } from "@/lib/accountSide";
import { useAuth } from "@/contexts/AuthContext";

const TABS = [
  { to: "/jobs", label: "For you" },
  { to: "/resume-matcher", label: "Match my resume" },
] as const;

type Pill = { left: number; width: number };

/**
 * Where the pill sat last. Each page mounts its own JobsTabs, so the strip is
 * rebuilt on every switch; remembering the old spot lets the new one start
 * there and slide across instead of appearing already in place.
 */
let lastPill: Pill | null = null;

/**
 * The two ways to find work, as tabs across the top of both pages: the
 * listings with what's picked for you, and matching against your resume.
 * A coral pill switch: the current tab sits in a white pill that slides
 * between them, the other is white text on the coral track.
 *
 * Not shown to employers: the matcher needs Premium, which is still a job
 * seeker plan, so the second tab would end at an upgrade they can't buy.
 */
export function JobsTabs() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [pill, setPill] = useState<Pill | null>(lastPill);

  const activeIndex = TABS.findIndex((tab) => tab.to === pathname);

  useLayoutEffect(() => {
    const el = tabRefs.current[activeIndex];
    if (!el) return;

    const measure = () => {
      const next = { left: el.offsetLeft, width: el.offsetWidth };
      lastPill = next;
      setPill(next);
    };

    // Paint once at the old spot, then move, so the change animates.
    const frame = requestAnimationFrame(measure);
    // Fonts loading or the window resizing change the tab widths.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [activeIndex]);

  if (accountSide(user) === "employer") return null;

  return (
    <nav aria-label="Find jobs" className="border-b border-gray-300 bg-card">
      <div className="container mx-auto flex justify-center px-4 py-3 md:px-12 lg:px-24">
        <div className="relative inline-flex items-stretch rounded-full bg-coral p-0.5">
          {pill && activeIndex >= 0 && (
            <span
              aria-hidden
              className="absolute inset-y-0.5 left-0 rounded-full bg-white shadow-sm transition-[transform,width] duration-300 ease-out motion-reduce:transition-none"
              style={{ width: pill.width, transform: `translateX(${pill.left}px)` }}
            />
          )}
          {TABS.map((tab, i) => (
            <NavLink
              key={tab.to}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              to={tab.to}
              end
              className={({ isActive }) =>
                cn(
                  "relative z-10 flex items-center whitespace-nowrap rounded-full px-5 py-2 text-sm font-semibold transition-colors duration-300 sm:px-7",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-coral-dark",
                  isActive
                    ? cn("text-neutral-950", !pill && "bg-white shadow-sm")
                    : "text-white",
                )
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}

export default JobsTabs;
