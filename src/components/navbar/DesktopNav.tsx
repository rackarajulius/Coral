import { Link } from "react-router-dom";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import {
  Layers,
  Palette,
  Brain,
  BarChart3,
  Gauge,
  HelpCircle,
  BookOpen,
  FileText,
  Video,
  CreditCard,
  Sparkles,
  Building2,
  Scale,
} from "lucide-react";
import path from "path";

const features = [
  { icon: Layers, title: "All Features", desc: "Complete platform overview", path: '/employers/features'  },
  { icon: Palette, title: "Employer Branding", desc: "Build your company presence", path: "/employers/branding" },
  { icon: Brain, title: "AI-Powered Hiring", desc: "Smart candidate matching", path: "/employers/ai-hiring" },
  { icon: BarChart3, title: "Advanced Analytics", desc: "Data-driven insights", path: "/employers/advanced-analytics" },
  { icon: Gauge, title: "Performance", desc: "Track hiring metrics", path: "/employers/performance" },
];

const resources = [
  { icon: HelpCircle, title: "Help Center", href: "/help" },
  { icon: BookOpen, title: "Blog", href: "/blog" },
  { icon: FileText, title: "Case Studies", href: "/case-studies" },
  { icon: Video, title: "Webinars", href: "/webinars" },
];

const pricing = [
  { icon: CreditCard, title: "Plans & Pricing", href: "/pricing" },
  { icon: Sparkles, title: "Free Trial", href: "/free-trial" },
  { icon: Building2, title: "Enterprise", href: "/enterprise" },
  { icon: Scale, title: "Compare Plans", href: "/pricing/compare" },
];

export const DesktopNav = () => (
  <nav className="hidden lg:block">
    <NavigationMenu>
      <NavigationMenuList className="gap-1">
        <NavigationMenuItem>
          <Link
            to="/find-talent"
            className="nav-link inline-flex h-9 items-center px-3 text-sm"
          >
            Find Talent
          </Link>
        </NavigationMenuItem>

        {/* Features Mega Menu */}
        <NavigationMenuItem>
          <NavigationMenuTrigger className="nav-link bg-transparent text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-transparent data-[state=open]:bg-transparent data-[state=open]:text-foreground">
            Features
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <div className="w-[420px] p-4 grid gap-1">
              {features.map((f) => (
                <Link
                  key={f.title}
                  to={f.path}
                  className="flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-secondary"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted/50 text-muted-foreground">
                    <f.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{f.title}</p>
                    <p className="text-xs text-muted-foreground">{f.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>

        {/* Resources */}
        <NavigationMenuItem>
          <NavigationMenuTrigger className="nav-link bg-transparent text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-transparent data-[state=open]:bg-transparent data-[state=open]:text-foreground">
            Resources
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <div className="w-[220px] p-2 grid gap-0.5">
              {resources.map((r) => (
                <Link
                  key={r.title}
                  to={r.href}
                  className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-secondary"
                >
                  <r.icon className="h-4 w-4 text-muted-foreground" />
                  {r.title}
                </Link>
              ))}
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>

        {/* Pricing */}
        <NavigationMenuItem>
          <NavigationMenuTrigger className="nav-link bg-transparent text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-transparent data-[state=open]:bg-transparent data-[state=open]:text-foreground">
            Pricing
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <div className="w-[200px] p-2 grid gap-0.5">
              {pricing.map((p) => (
                <Link
                  key={p.title}
                  to={p.href}
                  className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-secondary"
                >
                  <p.icon className="h-4 w-4 text-muted-foreground" />
                  {p.title}
                </Link>
              ))}
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  </nav>
);
