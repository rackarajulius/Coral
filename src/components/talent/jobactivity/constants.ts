export type TabId = "saved" | "alerts" | "applied" | "interviews" | "offers" | "viewed";

export const TABS: { id: TabId; label: string }[] = [
  { id: "saved", label: "Saved" },
  { id: "alerts", label: "Alerts" },
  { id: "applied", label: "Applied" },
  { id: "interviews", label: "Interviews" },
  { id: "offers", label: "Offers" },
  { id: "viewed", label: "Viewed Recently" },
];

export const BRAND = "#F97316";
export const PANEL_ID = "ja-tabpanel";
export const tabButtonId = (id: TabId) => `ja-tab-${id}`;
export const isTabId = (value: string | null): value is TabId =>
  TABS.some((t) => t.id === value);
