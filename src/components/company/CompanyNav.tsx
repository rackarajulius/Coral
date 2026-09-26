import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

/**
 * Every section this nav can point at. Which of them a given company actually
 * has is decided at render time — see `present` below.
 */
const tabs = [
  { id: "overview", label: "Overview" },
  { id: "culture", label: "Culture" },
  { id: "media", label: "Media" },
  { id: "benefits", label: "Benefits" },
  { id: "tides", label: "Coming up" },
  { id: "hiring", label: "Hiring" },
  { id: "jobs", label: "Jobs" },
  { id: "reviews", label: "Reviews" },
];

const CompanyNav = () => {
  const [active, setActive] = useState("overview");
  /**
   * Tabs whose section is really on the page.
   *
   * Sections hide themselves when a company hasn't filled them in, and the
   * responsiveness figures appear only once there are enough applications to
   * be fair about — so a fixed tab list means tabs that scroll nowhere. They
   * also arrive at different times, hence watching rather than checking once.
   */
  const [present, setPresent] = useState<string[]>(() => tabs.map((t) => t.id));
  const isScrollingRef = useRef(false);
  const tabsScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateFades = useCallback(() => {
    const el = tabsScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // Only update active tab from scroll if we aren't currently executing a manual click-scroll
        if (isScrollingRef.current) return;

        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.1) {
            setActive(entry.target.id);
          }
        });
      },
      { 
        // rootMargin captures the "active area" near the top of the screen
        rootMargin: "-120px 0px -70% 0px",
        threshold: [0, 0.1, 0.5]
      }
    );

    tabs.forEach((tab) => {
      const el = document.getElementById(tab.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [present]);

  useEffect(() => {
    const recount = () => {
      const found = tabs.filter((t) => document.getElementById(t.id)).map((t) => t.id);
      setPresent((prev) =>
        prev.length === found.length && prev.every((id, i) => id === found[i]) ? prev : found,
      );
    };
    recount();
    // Sections backed by their own request appear after the first paint.
    const watcher = new MutationObserver(recount);
    watcher.observe(document.body, { childList: true, subtree: true });
    return () => watcher.disconnect();
  }, []);

  useEffect(() => {
    updateFades();
    window.addEventListener('resize', updateFades);
    return () => window.removeEventListener('resize', updateFades);
  }, [updateFades]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      isScrollingRef.current = true;
      setActive(id);

      const offset = 140; // Adjusted for sticky header + nav height
      const top = el.getBoundingClientRect().top + window.scrollY - offset;

      window.scrollTo({ top, behavior: "smooth" });

      // Re-enable observer after smooth scroll completes
      setTimeout(() => {
        isScrollingRef.current = false;
      }, 800);
    }
  };

  return (
    <nav className="sticky top-16 z-40 w-full bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/60 rounded-xl border border-slate-200 border-t-0 relative">
      {canScrollLeft && (
        <div className="absolute left-0 top-0 bottom-0 w-10 bg-gradient-to-r from-background/95 to-transparent z-10 pointer-events-none rounded-l-xl" />
      )}
      {canScrollRight && (
        <div className="absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-background/95 to-transparent z-10 pointer-events-none rounded-r-xl" />
      )}
      <div
        ref={tabsScrollRef}
        onScroll={updateFades}
        className="max-w-[1280px] mx-auto flex items-center h-14 px-2 overflow-x-auto no-scrollbar scroll-smooth"
      >
        <div className="flex items-center gap-1">
          {tabs.filter((tab) => present.includes(tab.id)).map((tab) => {
            const isActive = active === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => scrollTo(tab.id)}
                className={cn(
                  "relative px-4 py-2 text-sm font-semibold transition-all duration-300 rounded-full whitespace-nowrap",
                  isActive 
                    ? "text-primary bg-primary/10 shadow-sm shadow-primary/5" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                {tab.label}
                {/* Optional: Underline indicator for extra visual flair */}
                {isActive && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full animate-in fade-in zoom-in duration-300" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default CompanyNav;