import QuickActionCard from "./QuickActionCard";
import SectionHeader from "@/components/employer-dashboard/overview/SectionHeader";
import { quickActions } from "@/data/employer/overview/data";

const QuickActionsGrid = () => (
  <section aria-label="Quick actions">
    <SectionHeader title="Quick actions" subtitle="Do the high-impact work in a few clicks." />
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
      {quickActions.map((q) => (
        <QuickActionCard key={q.title} {...q} />
      ))}
    </div>
  </section>
);

export default QuickActionsGrid;
