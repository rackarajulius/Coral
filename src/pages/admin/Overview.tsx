import React, { useState } from "react";
import { ActivityFeed } from "@/components/adminDashboard/overview/ActivityFeed";
import { DashboardCharts } from "@/components/adminDashboard/overview/DashboardCharts";
import { KPICard } from "@/components/adminDashboard/overview/KPICard";
import { useAdmin } from "@/contexts/AdminContext";
import { Users, Building2, Briefcase, FileText, UserPlus, Flag, DollarSign, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

// Icon mapping for dynamic rendering
const iconMap = {
  Users,
  Building2,
  Briefcase,
  FileText,
  UserPlus,
  Flag,
  DollarSign,
};

// Skeleton components
function KPISkeletonGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-start justify-between mb-2">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16" />
            </div>
            <Skeleton className="h-4 w-4 rounded" />
          </div>
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

function ChartsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Two chart cards in a row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <Skeleton className="h-4 w-32 mb-4" />
          <Skeleton className="h-60 w-full rounded" />
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <Skeleton className="h-4 w-36 mb-4" />
          <Skeleton className="h-60 w-full rounded" />
        </div>
      </div>
      {/* Single chart card */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <Skeleton className="h-4 w-40 mb-4" />
        <Skeleton className="h-48 w-full rounded" />
      </div>
    </div>
  );
}

function ActivityFeedSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card shadow-card">
      <div className="border-b border-border px-5 py-4">
        <Skeleton className="h-4 w-28" />
      </div>
      <div className="divide-y divide-gray-300">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3 px-5 py-3.5">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}

const Index = () => {
  const { metrics, isLoading, error, refreshMetrics } = useAdmin();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshMetrics();
    } finally {
      setIsRefreshing(false);
    }
  };

  // Transform metrics data to include React icons
  const kpis = metrics?.kpis.map((kpi) => ({
    ...kpi,
    icon: iconMap[kpi.icon as keyof typeof iconMap] ? React.createElement(iconMap[kpi.icon as keyof typeof iconMap], { className: "h-4 w-4" }) : null,
  })) || [];

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Dashboard Overview
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Real-time platform metrics and activity
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-9 rounded-full"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", isRefreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Show skeleton loading, error, or actual content */}
      {error ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button
              onClick={refreshMetrics}
              variant="outline"
              size="sm"
              className="rounded-full"
            >
              Try Again
            </Button>
          </div>
        </div>
      ) : !metrics || isLoading ? (
        <>
          {/* KPI Grid Skeleton */}
          <KPISkeletonGrid />

          {/* Charts Skeleton */}
          <ChartsSkeleton />

          {/* Activity Feed Skeleton */}
          <ActivityFeedSkeleton />
        </>
      ) : (
        <>
          {/* KPI Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {kpis.map((kpi) => (
              <KPICard key={kpi.label} {...kpi} />
            ))}
          </div>

      {/* Charts */}
      <DashboardCharts
        jobPostsData={metrics?.charts?.jobPostsOverTime || []}
        applicationsData={metrics?.charts?.applicationsByCategory || []}
        approvalData={metrics?.charts?.employerApprovalRate || []}
      />

      {/* Activity Feed */}
      <ActivityFeed recentActivity={metrics?.charts?.recentActivity || []} />
        </>
      )}
    </div>
  );
};

export default Index;
