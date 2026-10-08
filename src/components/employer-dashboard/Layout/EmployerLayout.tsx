import { useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { EmployerSidebar } from "@/components/employer-dashboard/Layout/EmployerSidebar";
import { LogOut, Plus } from "lucide-react";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useJobsStore } from "@/stores/jobsStore";
import { useEmployerCompanyStore } from "@/stores/employerCompanyStore";
import { useEmployerAnalyticsStore } from "@/stores/employerAnalyticsStore";

interface EmployerLayoutProps {
  children: React.ReactNode;
  /** Optional classes for <main> (e.g. overflow-hidden for full-height app views). */
  mainClassName?: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

const EmployerLayout = ({ children, mainClassName }: EmployerLayoutProps) => {
   const navigate = useNavigate();
   const { user, logout } = useAuth();
   const fetchJobs = useJobsStore((s) => s.fetchJobs);
   const fetchCompany = useEmployerCompanyStore((s) => s.fetchCompany);
   const fetchAnalytics = useEmployerAnalyticsStore((s) => s.fetchAnalytics);

   // Prefetch once per employer session so pages like the dashboard
   // can render with real data immediately on subsequent navigations.
   useEffect(() => {
     fetchJobs().catch(() => {});
     fetchCompany().catch(() => {});
     fetchAnalytics().catch(() => {});
   }, [fetchJobs, fetchCompany, fetchAnalytics]);

   const displayName = user?.displayName || user?.email || "Account";
   const email = user?.email || "";

    const handleLogout = async () => {
      await logout();
      // Clear cached company/jobs/analytics data so the next account doesn't briefly see
      // the previous employer's stale company name, banner, or KPI counts.
      // The company store owns a localStorage copy of the name now, so ask it
      // to forget rather than resetting the fields this file happens to know
      // about — a partial reset would leave that copy on disk.
      useEmployerCompanyStore.getState().forgetIdentity();
      useJobsStore.setState({ jobs: [], loading: false, loaded: false });
      useEmployerAnalyticsStore.setState({ analytics: null, loading: false, loaded: false });
      toast.success("Signed out successfully");
      navigate("/employers");
    };

  const isFullHeightMain = mainClassName?.includes("overflow-hidden");

  return (
    <SidebarProvider data-employer className="h-svh max-h-svh overflow-hidden">
      <div className="flex h-full min-h-0 w-full bg-white dark:bg-background">
        <EmployerSidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-white dark:bg-background md:my-2 md:mr-2 md:overflow-hidden md:rounded-md md:border md:border-border">
          <header className="z-30 flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/60 px-4 backdrop-blur-md">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
             <div className="flex items-center gap-2">
        <Button size="lg" className="gap-2 h-9 text-sm rounded-full" asChild>
          <Link to="/employers/jobs/post">
            <Plus className="h-3.5 w-3.5" />
            Post Job
          </Link>
        </Button>

        <NotificationBell className="h-9 w-9 rounded-lg hover:bg-secondary" />

       {/* Profile */}
           <DropdownMenu modal={false}>
             <DropdownMenuTrigger asChild>
               <Button variant="ghost" size="icon" className="rounded-full">
                 <Avatar className="h-8 w-8">
                   <AvatarImage src={user?.avatarUrl ?? ""} />
                   <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">{getInitials(displayName)}</AvatarFallback>
                 </Avatar>
               </Button>
             </DropdownMenuTrigger>
             <DropdownMenuContent align="end" className="w-56">
               <DropdownMenuLabel className="font-normal">
                 <p className="text-sm font-medium truncate">{displayName}</p>
                 <p className="text-xs text-muted-foreground truncate">{email}</p>
               </DropdownMenuLabel>
               <DropdownMenuSeparator />
               <DropdownMenuItem asChild><Link to="/employers/dashboard">Dashboard</Link></DropdownMenuItem>
               <DropdownMenuItem asChild><Link to="/employers/settings">Settings</Link></DropdownMenuItem>
               <DropdownMenuSeparator />
               <DropdownMenuItem
                 onClick={handleLogout}
                 aria-label="Sign out"
                className="gap-2 text-destructive focus:text-destructive">
                 <LogOut className="h-4 w-4" />
                 Sign out
               </DropdownMenuItem>
             </DropdownMenuContent>
           </DropdownMenu>
      </div>
          </header>
          <main
            className={cn(
              "relative flex min-h-0 flex-1 flex-col bg-white dark:bg-background",
              isFullHeightMain ? "overflow-hidden" : "employer-workspace-scroll overflow-auto",
              mainClassName
            )}
          >
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default EmployerLayout;
