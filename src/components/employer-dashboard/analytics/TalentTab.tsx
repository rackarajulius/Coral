import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { getTalent } from '@/lib/api/employerAnalytics';
import OutreachStatsCard from './OutreachStatsCard';
import OfferOutcomesCard from './OfferOutcomesCard';
import CompetitorsCard from './CompetitorsCard';
// Still mock: "Talent hotspots" below. Everything else on this tab is measured.
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
} from "recharts";
import React from 'react'
import { cn } from '@/lib/utils';


const TalentTab = () => {
  const talentQuery = useQuery({
    queryKey: ["employer-analytics-talent"],
    queryFn: getTalent,
    retry: false,
  });
  const skills = talentQuery.data?.skills ?? [];

function ChartFrame({ children, height = 260 }: { children: React.ReactNode; height?: number }) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>{children as any}</ResponsiveContainer>
    </div>
  );
};

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
    return (
      <div className={cn("rounded-xl border border-border bg-card shadow-card", className)}>
        {children}
      </div>
    );
  }

const CHART_COLORS = [
  "#2563eb", // Applications
  "#475569", // Recruiters
  "#16a34a", // Hires
  "#ea580c", // Interviews
  "#dc2626", // Rejections
];


  return (
    <div className="grid gap-6">
          {/* Measured — first, so real numbers are what someone reads before
              the one illustrative card (hotspots) further down. */}
          <OutreachStatsCard />
          <OfferOutcomesCard />
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="p-5 lg:col-span-2">
              <h2 className="text-base font-semibold">Talent supply vs demand</h2>
              <p className="text-xs text-muted-foreground">
                {talentQuery.data?.note ??
                  "Counts of live job posts and job-seeker profiles on this platform."}
              </p>
              {skills.length === 0 && !talentQuery.isLoading ? (
                <p className="mt-4 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  {talentQuery.isError
                    ? "Couldn't load skill data."
                    : "Add skills to your active job posts to see how demand compares with supply."}
                </p>
              ) : (
              <div className="mt-4">
                <ChartFrame height={280}>
                  <BarChart data={skills}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="skill" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <RTooltip
                      contentStyle={{
                        background: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="demand" fill={CHART_COLORS[0]} radius={[6, 6, 0, 0]} />
                    <Bar dataKey="supply" fill={CHART_COLORS[1]} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ChartFrame>
              </div>
              )}
            </Card>
    
            <Card className="p-5">
              <h2 className="text-base font-semibold">Talent hotspots</h2>
              <div className="mt-3 space-y-2">
                {[
                  { city: "Berlin", score: 92 },
                  { city: "Lisbon", score: 88 },
                  { city: "Austin", score: 84 },
                  { city: "Toronto", score: 79 },
                  { city: "Bengaluru", score: 76 },
                ].map((h) => (
                  <div key={h.city} className="flex items-center justify-between rounded-md border border-border p-2.5">
                    <span className="text-sm font-medium">{h.city}</span>
                    <Badge variant="secondary" className="tabular-nums">{h.score}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          </div>
    
          {/* Replaced an invented radar ("Industry avg 71"), a made-up salary
              list and a competitor trend drawn from sample data. */}
          <CompetitorsCard />
        </div>
  )
};

export default TalentTab;
