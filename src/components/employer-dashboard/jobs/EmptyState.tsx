import { Briefcase,  Inbox, Archive, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface Props {
  variant: "no-jobs" | "no-results" | "no-active" | "no-closed";
  onClearFilters?: () => void;
}

export default function EmptyState({ variant, onClearFilters }: Props) {
  const map = {
    "no-jobs": {
      icon: Briefcase,
      title: "Create Your First Job",
      desc: "Start attracting top talent by publishing your first job posting.",
      cta: <Button asChild size="sm" variant="default"><Link to="/employers/jobs/post"><Plus className="h-4 w-4 mr-1.5" />Create Job</Link></Button>,
    },
    "no-results": {
      // Intentionally icon-less (the render guards for it) — declared so every
      // union member shares the key and `map[variant]` stays destructurable.
      icon: undefined,
      title: "No Matching Jobs Found",
      desc: "Try adjusting your search or filters.",
      cta: (
        <div className="flex gap-2">
          {onClearFilters && <Button size="sm" variant="outline" onClick={onClearFilters}>Clear Filters</Button>}
          <Button size="sm" asChild><Link to="/employers/jobs/post"><Plus className="h-4 w-4 mr-1.5" />Create New Job</Link></Button>
        </div>
      ),
    },
    "no-active": {
      icon: Inbox,
      title: "No Active Openings",
      desc: "You currently have no jobs accepting applications.",
      cta: <Button size="sm" asChild><Link to="/employers/jobs/post"><Plus className="h-4 w-4 mr-1.5" />Post New Job</Link></Button>,
    },
    "no-closed": {
      icon: Archive,
      title: "No Closed Positions",
      desc: "Closed jobs will appear here when positions are completed.",
      cta: null,
    },
  } as const;

  const { icon: Icon, title, desc, cta } = map[variant];
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      {Icon && <Icon className="h-10 w-10 text-muted-foreground mb-4" />}
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1.5 max-w-sm">{desc}</p>
      {cta && <div className="mt-5">{cta}</div>}
    </div>
  );
}
