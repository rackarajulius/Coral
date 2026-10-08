import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Briefcase, X } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { BRAND_NAME } from "@/lib/brand";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Layers, Palette, Brain, BarChart3, Gauge,
  HelpCircle, BookOpen, FileText, Video,
} from "lucide-react";

const features = [
  { icon: Layers, title: "All Features", path: '/employers/features'  },
  { icon: Palette, title: "Employer Branding", path: '/employers/branding'},
  { icon: Brain, title: "AI-Powered Hiring", path: '/employers/ai-hiring' },
  { icon: BarChart3, title: "Advanced Analytics", path: '/employers/advanced-analytics' },
  { icon: Gauge, title: "Performance",  path: '/employers/performance' },
];

const resources = [
  { icon: HelpCircle, title: "Help Center", href: "/help" },
  { icon: BookOpen, title: "Blog", href: "/blog" },
  { icon: FileText, title: "Case Studies", href: "/case-studies" },
  { icon: Video, title: "Webinars", href: "/webinars" },
];

const pricing = [
  { title: "Plans & Pricing", href: "/pricing" },
  { title: "Free Trial", href: "/free-trial" },
  { title: "Enterprise", href: "/enterprise" },
  { title: "Compare Plans", href: "/pricing/compare" },
];

interface MobileMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const MobileMenu = ({ open, onOpenChange }: MobileMenuProps) => {
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    onOpenChange(false);
  }, [location.pathname]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[300px] p-0 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 h-16 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-coral/10 text-coral">
              <Briefcase className="h-4 w-4" />
            </div>
            <span className="text-base font-semibold tracking-tight text-foreground">{BRAND_NAME}</span>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar">
          <Link
            to="/find-talent"
            className="flex items-center px-3 py-2.5 text-sm font-medium text-foreground rounded-md hover:bg-secondary transition-colors"
          >
            Find Talent
          </Link>

          <Accordion type="multiple" className="mt-1">
            <AccordionItem value="features" className="border-none">
              <AccordionTrigger className="px-3 py-2.5 text-sm font-medium hover:no-underline hover:bg-secondary rounded-md">
                Features
              </AccordionTrigger>
              <AccordionContent className="pb-1 pt-0">
                {features.map((f) => (
                  <Link
                    key={f.title}
                    to={f.path}
                    className="flex items-center gap-2.5 px-3 py-2 ml-2 text-sm text-muted-foreground rounded-md hover:bg-secondary hover:text-foreground transition-colors"
                  >
                    <f.icon className="h-4 w-4" />
                    {f.title}
                  </Link>
                ))}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="resources" className="border-none">
              <AccordionTrigger className="px-3 py-2.5 text-sm font-medium hover:no-underline hover:bg-secondary rounded-md">
                Resources
              </AccordionTrigger>
              <AccordionContent className="pb-1 pt-0">
                {resources.map((r) => (
                  <Link
                    key={r.title}
                    to={r.href}
                    className="flex items-center gap-2.5 px-3 py-2 ml-2 text-sm text-muted-foreground rounded-md hover:bg-secondary hover:text-foreground transition-colors"
                  >
                    <r.icon className="h-4 w-4" />
                    {r.title}
                  </Link>
                ))}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="pricing" className="border-none">
              <AccordionTrigger className="px-3 py-2.5 text-sm font-medium hover:no-underline hover:bg-secondary rounded-md">
                Pricing
              </AccordionTrigger>
              <AccordionContent className="pb-1 pt-0">
                {pricing.map((p) => (
                  <Link
                    key={p.title}
                    to={p.href}
                    className="flex items-center px-3 py-2 ml-2 text-sm text-muted-foreground rounded-md hover:bg-secondary hover:text-foreground transition-colors"
                  >
                    {p.title}
                  </Link>
                ))}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* Bottom CTA */}
        <div className="px-5 py-4 border-t border-border">
          {/* The same entry as the landing page's buttons: signs a visitor up, or
              takes an employer to their dashboard. (It used to point at
              /employer-signup, which doesn't exist.) */}
          <Button className="w-full gradient-accent text-primary-foreground" asChild>
            <Link to="/employers/dashboard">{isAuthenticated ? "Go to dashboard" : "Get Started"}</Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
