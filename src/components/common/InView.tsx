import { useEffect, useRef, useState } from "react";

/**
 * Renders its children once they are near the viewport, and never unmounts
 * them again.
 *
 * The company page stacks a dozen sections, several of which fetch on mount —
 * so opening it fires half a dozen requests at once for material most readers
 * never scroll to. Wrapping the heavy ones defers the request to the moment
 * someone is actually about to read it.
 *
 * Once shown, it stays: unmounting on scroll-out would refetch every time
 * someone scrolled back up, which is worse than not deferring at all.
 *
 * `placeholder` keeps the page from jumping as sections appear — without a
 * reserved height the scrollbar lurches every time one loads.
 */
export function InView({
  children,
  placeholder = null,
  rootMargin = "300px",
}: {
  children: React.ReactNode;
  placeholder?: React.ReactNode;
  /** How early to mount. 300px means it is ready by the time it is read. */
  rootMargin?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (shown) return;

    // Deferring is an optimisation, never a gate, so every way this can fail
    // ends in the content being shown. Both of these checks come before the
    // observer is built:
    //  - no IntersectionObserver (old browsers);
    //  - no node to watch, which happens wherever refs are not attached to
    //    real elements. Returning early there would leave the section blank
    //    for good.
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const el = ref.current;
    if (!el) {
      setShown(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setShown(true);
      },
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [shown, rootMargin]);

  return <div ref={ref}>{shown ? children : placeholder}</div>;
}

export default InView;
