import { useQuery } from "@tanstack/react-query";
import {
  Briefcase, Building2, CalendarClock, CheckCircle2, Clock, Loader2,
  MessageCircle, RefreshCcw, Sparkles, UsersRound, Video, Zap,
} from "lucide-react";
import NextActionCard from "./NextActionCard";
import SectionHeader from "@/components/employer-dashboard/overview/SectionHeader";
import { getNextActions } from "@/lib/api/employerNextActions";

/** The server sends an icon name; resolve it to a component here. */
const ICONS: Record<string, React.ElementType> = {
  MessageCircle,
  UsersRound,
  Sparkles,
  Clock,
  CalendarClock,
  RefreshCcw,
  Briefcase,
  Building2,
  Video,
  Zap,
};

const NextBestActions = () => {
  const { data: actions, isLoading } = useQuery({
    queryKey: ["employer-next-actions"],
    queryFn: getNextActions,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  return (
    <div>
      <SectionHeader title="Next best actions" subtitle="Small steps that compound results." />

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card p-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Checking your pipeline…
        </div>
      ) : !actions || actions.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-emerald-500" />
          <p className="text-sm font-medium text-foreground">Nothing needs you right now</p>
          <p className="mt-1 text-sm text-muted-foreground">
            No unanswered candidates, pending reviews, or setup gaps.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {actions.map((a) => (
            <NextActionCard
              key={a.id}
              icon={ICONS[a.icon] ?? Zap}
              title={a.title}
              desc={a.desc}
              cta={a.cta}
              to={a.to}
              highlight={a.highlight}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default NextBestActions;
