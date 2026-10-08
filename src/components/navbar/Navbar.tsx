import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Briefcase } from "lucide-react";
import { DesktopNav } from "./DesktopNav";
import { NavActions } from "./NavActions";
import { MobileMenu } from "./MobileMenu";
import { BRAND_NAME } from "@/lib/brand";

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 h-16 transition-all duration-300 ${
        scrolled
          ? "bg-card/80 backdrop-blur-md border-b border-border shadow-soft"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="container h-full flex items-center justify-between">
        {/* Left: Logo + Nav */}
        <div className="flex items-center gap-8">
          <Link to="/employers" className="flex items-center gap-2 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-coral/10 text-coral transition-colors group-hover:bg-coral/20">
              <Briefcase className="h-5 w-5" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-lg font-semibold tracking-tight text-foreground">
                {BRAND_NAME}
              </span>
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
                employer
              </span>
            </div>
          </Link>

          <DesktopNav />
        </div>

        {/* Right: Actions */}
        <NavActions onMobileOpen={() => setMobileOpen(true)} />
      </div>

      <MobileMenu open={mobileOpen} onOpenChange={setMobileOpen} />
    </header>
  );
};

export default Navbar;
