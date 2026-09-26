import { useState } from "react";
import Workspace from "@/components/employer-dashboard/analytics/Workspace";
import PageHeader from "@/components/employer-dashboard/analytics/Overview/PageHeader";

const TABS = [
  { id: "overview" },
  { id: "brand" },
  { id: "jobs" },
  { id: "funnel" },
  { id: "talent" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function Analytics() {
  const [tab, setTab] = useState<TabId>("overview");

  return (
      <div className="mx-auto w-full max-w-[1200px] px-6 py-10 md:px-10 md:py-12">
        <PageHeader />
        <Workspace tab={tab} setTab={setTab} />
      </div>
  );
}