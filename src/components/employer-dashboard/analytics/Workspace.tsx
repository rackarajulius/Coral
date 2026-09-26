import React from 'react'
import OverviewTab from './Overview/OverviewTab';
import BrandTab from './BrandTab';
import JobsTab from './JobsTab';
import FunnelTab from './FunnelTab';
import TalentTab from './TalentTab';
import { cn } from '@/lib/utils';
import { Briefcase, Globe2, LayoutDashboard, Megaphone,  Filter as FunnelIcon, } from 'lucide-react';


type TabId = (typeof TABS)[number]["id"];
const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "brand", label: "Employer Brand", icon: Megaphone },
  { id: "jobs", label: "Job Performance", icon: Briefcase },
  { id: "funnel", label: "Candidate Funnel", icon: FunnelIcon },
  { id: "talent", label: "Talent Intelligence", icon: Globe2 },
] as const;

const Workspace = ({ tab, setTab }: { tab: TabId; setTab: (t: TabId) => void }) => {

  return (
    <div className="mt-6 ">
      <nav
  role="tablist"
  className="flex border-b border-border bg-card"
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={cn(
                "relative flex shrink-0 items-center gap-2 px-4 py-3 text-sm font-medium transition-colors",
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
              <span
                className={cn(
                  "absolute inset-x-3 -bottom-px h-0.5 rounded-full transition-all",
                  active ? "bg-orange-500 opacity-100" : "bg-transparent opacity-0"
                )}
              />
            </button>
          );
        })}
      </nav>

      <div className="mt-6 animate-fade-in">
        {tab === "overview" && <OverviewTab onJump={setTab} />}
        {tab === "brand" && <BrandTab />}
        {tab === "jobs" && <JobsTab />}
        {tab === "funnel" && <FunnelTab />}
        {tab === "talent" && <TalentTab />}
      </div>
    </div>
    
  );
};

export default Workspace;
