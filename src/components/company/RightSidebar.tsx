import { 
  Bell, Briefcase, ArrowRight, Zap, TrendingUp, 
  MapPin, Users, Plus 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { mockCompany } from '@/data/mockCompany';
import { cn } from '@/lib/utils';

const RightSidebar = () => {
  // Stats helper for Insights
  const insights = [
    { value: String(mockCompany.jobs.length), label: "Open roles" },
    { value: "5", label: "Departments" },
    { value: "3", label: "New offices" },
    { value: "3 days", label: "Avg. response" },
  ];

  return (
    <div className="space-y-5">
      {/* 1. Open Jobs Quick-View */}
      <Card className="border-border/50 rounded-2xl shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
          <CardTitle className="text-sm font-bold flex items-center gap-2 tracking-tight">
            <Briefcase className="h-4 w-4 text-primary" />
            Active Opportunities
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 space-y-1">
          {mockCompany.jobs.slice(0, 3).map((job) => (
            <a
              key={job.title}
              href="#jobs"
              className="block p-3 rounded-xl hover:bg-primary/[0.03] transition-all group border border-transparent hover:border-primary/10"
            >
              <div className="flex justify-between items-start">
                <p className="text-sm font-semibold group-hover:text-primary transition-colors leading-none">
                  {job.title}
                </p>
                <ArrowRight className="h-3 w-3 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-primary" />
              </div>
              <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground font-medium">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {job.location}
                </span>
                <span className="text-muted-foreground/30">•</span>
                <span>{job.type}</span>
              </div>
            </a>
          ))}
          
          <div className="px-1 pt-2 pb-1">
            <Button variant="ghost" className="w-full justify-between text-xs font-bold text-primary hover:bg-primary/5 rounded-xl group" size="sm">
              View all {mockCompany.jobs.length} listings
              <Plus className="h-3.5 w-3.5 transition-transform group-hover:rotate-90" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 2. Hiring Insights (Premium Look) */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.02] to-primary/[0.08] rounded-2xl shadow-inner">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Talent Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {insights.map((stat) => (
              <div key={stat.label} className="flex flex-col items-center justify-center p-3 rounded-2xl bg-background shadow-sm border border-border/40">
                <p className="text-lg font-black text-primary tracking-tighter">{stat.value}</p>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-tight mt-0.5">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 p-3 rounded-2xl bg-background border border-primary/10 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-1">
               <div className="h-1.5 w-1.5 rounded-full bg-primary animate-ping" />
            </div>
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Zap className="h-4 w-4 text-primary fill-primary/20" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground tracking-tight">Actively Hiring</p>
              <p className="text-[10px] text-muted-foreground font-medium">Responds in ~72 hours</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Social Interaction / CTA */}
      <div className="p-4 bg-secondary/30 rounded-2xl border border-border/50 space-y-3">
          <Button className="w-full gap-2 rounded-xl font-bold shadow-md shadow-primary/10 h-10">
            <Bell className="h-4 w-4" />
            Follow Company
          </Button>
          <Button variant="outline" className="w-full gap-2 rounded-xl font-semibold bg-background h-10" size="sm">
            Set Job Alert
          </Button>
          <p className="text-[10px] text-center text-muted-foreground/80 font-medium leading-relaxed px-4">
            Join 12.4k others following this brand for updates
          </p>
      </div>

      {/* 4. Similar Companies */}
      <Card className="border-border/50 rounded-2xl shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Competitors
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 px-2">
          {mockCompany.similarCompanies.slice(0, 4).map((co) => (
            <div
              key={co.name}
              className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted/50 transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-secondary to-muted border border-border/50 flex items-center justify-center font-bold text-muted-foreground shrink-0 group-hover:from-primary/10 group-hover:text-primary transition-all">
                  {co.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold group-hover:text-primary transition-colors truncate">
                    {co.name}
                  </p>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-tight truncate">
                    {co.industry}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] font-bold border-border/60 text-muted-foreground bg-background shrink-0">
                {co.jobs} jobs
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default RightSidebar;