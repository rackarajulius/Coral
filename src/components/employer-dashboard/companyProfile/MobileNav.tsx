import { useLocation, Link } from "react-router-dom";
import { LayoutDashboard, Briefcase, Users, MessageSquare, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { label: "Home", icon: LayoutDashboard, path: "/" },
  { label: "Jobs", icon: Briefcase, path: "/jobs" },
  { label: "Candidates", icon: Users, path: "/candidates" },
  { label: "Messages", icon: MessageSquare, path: "/messages" },
  { label: "Analytics", icon: BarChart3, path: "/analytics" },
];

export function MobileNav() {
  const location = useLocation();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-sm border-t border-border px-2 py-1.5 safe-area-bottom">
      <div className="flex items-center justify-around">
        {items.map((item) => {
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors text-[11px]",
                active ? "text-accent" : "text-muted-foreground"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
