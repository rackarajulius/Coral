import { Link } from "react-router-dom";
import { Briefcase, ChevronDown, Menu, X, Zap, BarChart3, Heart, Rocket, BookOpen, HelpCircle, FileText, Video } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const features = [
  { label: "All Features", path: '/employer-features' },
  { label: "Employer Branding", path: '/employer-branding' },
  { label: "AI-Powered Hiring", path: '/ai-hiring' },
  { label: "Advanced Analytics", path: '/analytics' },
  { label: "Performance Boost", path: '/performance' },
];

const resources = [
  { label: "Help Center", path: '/help-center', icon: HelpCircle },
  { label: "Blog", path: '/blog', icon: BookOpen },
  { label: "Case Studies", path: '/case-studies', icon: FileText },
  { label: "Webinars", path: '/webinars', icon: Video },
];

const pricing = [
  { label: "Plans & Pricing", path: '#pricing' },
  { label: "Free Trial", path: '#pricing' },
  { label: "Enterprise", path: '#pricing' },
  { label: "Compare Plans", path: '#pricing' },
];

const EmployerNavbar = () => {
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const openFeatures = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setFeaturesOpen(true);
  };

  const closeFeatures = () => {
    timeoutRef.current = setTimeout(() => setFeaturesOpen(false), 250);
  };

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-secondary backdrop-blur-xl border-b border-border shadow-sm"
            : "bg-secondary"
        }`}
      >
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 shrink-0">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Briefcase className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-bold text-lg text-foreground">
                JobConnect Pro
              </span>
            </Link>

            {/* Desktop nav */}
            {!isMobile && (
              <div className="flex items-center gap-1">
                 <Link to="/talent" className="nav-link font-medium text-muted-foreground hover:text-foreground transition-colors">
                                   Find Talent
                                  </Link>


                {/* Features - hover dropdown */}
                <div
                  ref={featuresRef}
                  className="relative"
                  onMouseEnter={openFeatures}
                  onMouseLeave={closeFeatures}
                >
                  <button className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md transition-colors">
                    Features
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform duration-200 ${
                        featuresOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                </div>

                {/* Resources */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md transition-colors">
                      Resources
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                      {resources.map((item) => (
                      <DropdownMenuItem asChild key={item.label}>
                          <Link to={item.path} className="flex items-center gap-2">
                            <item.icon className="h-4 w-4 text-muted-foreground" />
                            {item.label}
                         </Link>
                      </DropdownMenuItem>
                         ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Pricing */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md transition-colors">
                      Pricing
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    {pricing.map((item) => (
                      <DropdownMenuItem key={item.label} className="cursor-pointer">
                        {item.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            {/* Right actions */}
            <div className="flex items-center gap-2">
              {!isMobile && (
                <>
                  <Link
                    to="/home"
                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
                  >
                    For Job Seekers
                  </Link>
                  <Button
                   variant="outline"
                    size="sm"
                    >
                    Sign In
                  </Button>
                </>
              )}
              <Button variant="default" size={isMobile ? "sm" : "default"}>
                Get Started
              </Button>

              {/* Mobile hamburger */}
              {isMobile && (
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="ml-1">
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-72">
                    <SheetHeader>
                      <SheetTitle>Menu</SheetTitle>
                    </SheetHeader>
                    <div className="flex flex-col gap-1 mt-6">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-1">
                        Features
                      </p>
                      {features.map((f) => (
                        <Link
                          key={f.label}
                          to={f.path}
                          className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors"
                        >
                          {f.label}
                        </Link>
                      ))}
                      <div className="h-px bg-border my-3" />
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-1">
                        Resources
                      </p>
                      {resources.map((r) => (
                        <span
                          key={r.label}
                          className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors cursor-pointer"
                        >
                          <r.icon className="h-4 w-4 text-muted-foreground" />
                          {r.label}
                        </span>
                      ))}
                      <div className="h-px bg-border my-3" />
                      <Link
                        to="/companies"
                        className="px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors"
                      >
                        For Job Seekers
                      </Link>
                      <button className="px-3 py-2 text-sm text-left rounded-md hover:bg-accent transition-colors">
                        Sign In
                      </button>
                    </div>
                  </SheetContent>
                </Sheet>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Features mega dropdown - rendered below navbar */}
      {featuresOpen && !isMobile && (
        <div
          className="fixed top-16 left-0 right-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border shadow-lg"
          onMouseEnter={openFeatures}
          onMouseLeave={closeFeatures}
        >
          <div className="container mx-auto px-6 py-6">
            <div className="grid grid-cols-3 lg:grid-cols-5 gap-2">
             {features.map((f) => (
                  <Link
                     key={f.label}
                     to={f.path}
                     onClick={() => setFeaturesOpen(false)}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl hover:bg-accent transition-colors text-center"
                    >
                   <span className="text-sm font-medium text-foreground">
                    {f.label}
                   </span>
                 </Link>
               ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default EmployerNavbar;
