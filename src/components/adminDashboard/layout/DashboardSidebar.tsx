import {
  LayoutDashboard,
  Building2,
  Briefcase,
  FileText,
  Flag,
  DollarSign,
  Settings,
  ChevronLeft,
  ChevronDown,
  Menu,
  Activity,
  UsersRound,
  ClipboardList,
  Bell,
  ShieldCheck,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

type NavChild = {
  label: string;
  path: string;
};

type NavItemType = {
  icon: any;
  label: string;
  path?: string;
  children?: NavChild[];
};

const navItems: NavItemType[] = [
  { icon: LayoutDashboard, label: "Overview", path: "/admin/dashboard" },
  { icon: UsersRound, label: "Jobseekers", path: "/admin/jobseekers" },
  { icon: Building2, label: "Employers", path: "/admin/employers" },
  { icon: Briefcase, label: "Jobs", path: "/admin/jobs" },
  { icon: FileText, label: "Applications", path: "/admin/applications" },
  { icon: ShieldCheck, label: "Verifications", path: "/admin/verifications" },
  { icon: Flag, label: "Reports & Flags", path: "/admin/reports" },
  { icon: Activity, label: "System Health", path: "/admin/system-health" },
  { icon: ClipboardList, label: "Audit Logs", path: "/admin/audit-logs" },
  { icon: Bell, label: "Alerts", path: "/admin/alerts" },

  {
    icon: Settings,
    label: "Settings",
    children: [
      { label: "General", path: "/admin/general" },
      { label: "Taxonomies", path: "/admin/taxonomies" },
      { label: "Email Templates", path: "/admin/email-templates" },
      { label: "Seo Branding", path: "/admin/seo-branding" },
      { label: "Roles & Permissions", path: "/admin/roles" },
      { label: "Automation", path: "/admin/automation" },
      { label: "Integrations", path: "/admin/integrations" },
      
    ],
  },
];

function NavItem({
  item,
  collapsed,
  openDropdown,
  setOpenDropdown,
}: {
  item: NavItemType;
  collapsed: boolean;
  openDropdown: string | null;
  setOpenDropdown: (val: string | null) => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();

  const isOpen = openDropdown === item.label;

  const isActive = item.path && location.pathname === item.path;

  const isChildActive = item.children?.some((child) =>
    location.pathname.startsWith(child.path)
  );

  //  Auto-open when route is active
  useEffect(() => {
    if (item.children && isChildActive) {
      setOpenDropdown(item.label);
    }
  }, [location.pathname]);

  return (
    <div>
      {/* Parent */}
      <button
        onClick={() => {
          if (item.children) {
            setOpenDropdown(isOpen ? null : item.label);
          } else if (item.path) {
            navigate(item.path);
          }
        }}
        className={cn(
          "flex w-full items-center justify-between rounded-full px-3 py-2.5 text-sm font-medium transition-all",
          isActive || isChildActive
            ? "bg-secondary text-foreground"
            : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
        )}
      >
        <div className="flex items-center gap-3">
          <item.icon className="h-[18px] w-[18px]" />
          {!collapsed && <span>{item.label}</span>}
        </div>

        {item.children && !collapsed && (
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform",
              isOpen && "rotate-180"
            )}
          />
        )}
      </button>

      {/* Children */}
      {item.children && isOpen && !collapsed && (
        <div className="ml-7 mt-1 flex flex-col gap-1">
          {item.children.map((child) => {
            const active = location.pathname === child.path;

            return (
              <button
                key={child.path}
                onClick={() => navigate(child.path)}
                className={cn(
                  "text-left text-sm px-3 py-2 rounded-full transition",
                  active
                    ? "bg-secondary text-foreground font-medium"
                    : "text-muted-foreground hover:bg-secondary/50"
                )}
              >
                {child.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SidebarContent({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  return (
    <>
      {/* Toggle */}
      <div className="flex justify-end p-2">
        <Button variant="ghost" size="icon" onClick={onToggle} className="rounded-full">
          <ChevronLeft
            className={cn(
              "h-4 w-4 transition-transform",
              collapsed && "rotate-180"
            )}
          />
        </Button>
      </div>

      {/* Nav */}
      <nav
        className={cn(
          "flex-1 px-2 space-y-1 transition-all",
          openDropdown ? "overflow-y-auto scrollbar" : "overflow-hidden scrollbar-hidden"
        )}
      >
        {navItems.map((item) => (
          <NavItem
            key={item.label}
            item={item}
            collapsed={collapsed}
            openDropdown={openDropdown}
            setOpenDropdown={setOpenDropdown}
          />
        ))}
      </nav>
    </>
  );
}

export function DashboardSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="fixed top-3 left-3 z-40 h-9 w-9 rounded-full"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>

        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex flex-col h-full pt-4">
            <SidebarContent
              collapsed={false}
              onToggle={() => {}}
            />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside
      className={cn(
        "sticky top-14 h-[calc(100vh-3.5rem)] border-r bg-card flex flex-col transition-all duration-200",
        collapsed ? "w-[60px]" : "w-[220px]"
      )}
    >
      <SidebarContent
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
      />
    </aside>
  );
}