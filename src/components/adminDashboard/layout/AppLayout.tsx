import { Outlet, Navigate } from "react-router-dom";
import { TopNav } from "./TopNav";
import { DashboardSidebar } from "./DashboardSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";

// Lightweight skeleton of the admin shell, shown only while the auth/role check
// is in flight. Each page (e.g. Overview) owns its own data-loading skeletons,
// so the shell is no longer blocked on dashboard metrics.
function ShellSkeleton() {
  return (
    <div className="min-h-screen bg-white dark:bg-background">
      {/* Top nav */}
      <div className="h-14 border-b border-border flex items-center justify-between px-4">
        <Skeleton className="h-6 w-32" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>
      <div className="flex">
        {/* Sidebar */}
        <div className="hidden md:block w-[220px] border-r border-border p-2 space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-full" />
          ))}
        </div>
        {/* Content */}
        <div className="flex-1 p-6 lg:p-8 space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function AppLayout() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  // Only the auth/role check gates the shell. Page-level data (dashboard
  // metrics, tables, etc.) loads inside each page with its own skeletons.
  if (authLoading) {
    return <ShellSkeleton />;
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // The role is a placeholder until the backend answers; don't bounce on it.
  if (user.provisional) {
    return <ShellSkeleton />;
  }

  // Check if user is admin
  if (user.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-white dark:bg-background">
      <TopNav />
      <div className="flex w-full">
        <DashboardSidebar />
        <main className="flex-1 min-w-0 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
